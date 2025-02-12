import { MempoolChainProvider, RPCChainProvider, SupportedNetwork, btcRpc, utils } from "l1";
import { L1TxStatus } from "../../state";
import * as env from "../env";
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib'
import fetch from 'cross-fetch'
import Decimal from 'decimal.js'
import { UTXO } from "scrypt-ts";

/**
 * get block/tx/utxo info from l1 onchain
 * 
 * this is different from chainProvider or utxoProvider in l1/src/provider.ts, the main difference is:
 * L1ChainProvider fetch more fields like block_height
 */

type L1ChainProvider = {
    getCurrentBlockNumber: () => Promise<number>;
    listUtxos: (address: string, fromBlock: number, toBlock: number) => Promise<Utxo[]>;
    getTransactionStatus: (txid: string) => Promise<L1TxStatus['status']>;
}

export const UNCONFIRMED_BLOCK_NUMBER = -1;

class L1MempoolChainProvider extends MempoolChainProvider implements L1ChainProvider {
    async getCurrentBlockNumber(): Promise<number> {
        const res = await fetch(`${this.getMempoolApiHost()}/api/blocks/tip/height`)
        const data = await res.text()
        if (res.status !== 200) {
            throw new Error(`Failed to get current block number: status: ${res.status}, body: ${data}`)
        }
        return parseInt(data)
    }
    async listUtxos(address: string, fromBlock: number, toBlock: number): Promise<Utxo[]> {
        
        const script = Buffer.from(
            bitcoinjs.address.toOutputScript(
            address,
            utils.supportedNetworkToBtcNetwork(this.network)
            )
        ).toString('hex')
        const res = await fetch(`${this.getMempoolApiHost()}/api/address/${address}/utxo`)
        if (res.status !== 200) {
            throw new Error(`Failed to list utxos: status: ${res.status}, body: ${await res.text()}`)
        }
        const data = await res.json()
        /*
        data: 
        [
            {
                "txid": "75435334eb72b0fc1e15b98c2c253de65ae86b2418a5d31dd4d719158007e7e8",
                "vout": 97,
                "status": {
                "confirmed": true,
                "block_height": 232662,
                "block_hash": "000001306a895f1dd820efcbaaa71070eb93a462ebaf77e75b7c01ff8658f5e2",
                "block_time": 1737883756
                },
                "value": 10000
            },
            {
                "txid": "dcbb72a8ce527b8c31b1dc834cd78a4fdca7f47c41746a3d463acf2d47ea418b",
                "vout": 11,
                "status": {
                "confirmed": false
                },
                "value": 10000
            }
        ]
        */
        const utxos = data.map((utxo: any) => ({
            txId: utxo.txid,
            outputIndex: utxo.vout,
            satoshis: Number(utxo.value),
            script: utxo.script || script,
            blockNumber: utxo.status.block_height || UNCONFIRMED_BLOCK_NUMBER,
        }))
        // todo: confirm should use equal or greater than fromBlock
        return utxos.filter((utxo: Utxo) => utxo.blockNumber >= fromBlock && utxo.blockNumber <= toBlock)
    }
    async getTransactionStatus(txid: string): Promise<L1TxStatus['status']> {
        const res = await fetch(`${this.getMempoolApiHost()}/api/tx/${txid}`)
        if (res.status === 404) {
            return 'DROPPED' as const
        }
        if (res.status !== 200) {
            throw new Error(`Failed to get transaction status: status: ${res.status}, body: ${await res.text()}`)
        }
        const data = await res.json()
        if (data.status.confirmed) {
            return 'MINED' as const
        }
        return 'UNCONFIRMED' as const
    }
}
class L1RPCChainProvider extends RPCChainProvider implements L1ChainProvider {
    async getCurrentBlockNumber(): Promise<number> {
        const data = await btcRpc.rpc_getblockchaininfo(this.url, this.username, this.password)
        return data.blocks
    }
    async listUtxos(address: string, fromBlock: number, toBlock: number): Promise<Utxo[]> {
        const data = await btcRpc.rpc_listunspent(this.url, this.username, this.password, this.walletName, address, fromBlock, toBlock)
        const blockNumber = await this.getCurrentBlockNumber();

        const utxos = data.map((utxo: any) => ({
            txId: utxo.txid,
            outputIndex: utxo.vout,
            satoshis: new Decimal(utxo.amount)
                .mul(new Decimal(100000000))
                .toNumber(),
            script: utxo.scriptPubKey,
            blockNumber: utxo.confirmations > 0 ? blockNumber + 1 - utxo.confirmations : UNCONFIRMED_BLOCK_NUMBER,
        }))
        return utxos.filter((utxo: Utxo) => utxo.blockNumber >= fromBlock && utxo.blockNumber <= toBlock)
    }
    async getTransactionStatus(txid: string): Promise<L1TxStatus['status']> {
        const data = await btcRpc.rpc_gettransaction(this.url, this.username, this.password, this.walletName, txid)
        return data.confirmations > 0 ? 'MINED' as const : 'UNCONFIRMED' as const
    }
}   
export async function getCurrentBlockNumber(): Promise<number> {
    if (env.use_rpc) {
        return new L1RPCChainProvider(env.rpcConfig.host, env.rpcConfig.user, env.rpcConfig.password, env.rpcConfig.wallet).getCurrentBlockNumber()
    }
    return new L1MempoolChainProvider(env.l1Network).getCurrentBlockNumber()
}

export type Utxo = UTXO & {
    // txId: string;
    // outputIndex: number;
    // satoshis: number;
    // script: string;
    blockNumber: number;
}
export async function listUtxos(
    address: string,
    fromBlock?: number,
    toBlock?: number
): Promise<Utxo[]> {
    fromBlock = fromBlock ?? 0;
    toBlock = toBlock ?? 999999;
    if (env.use_rpc) {
        return new L1RPCChainProvider(env.rpcConfig.host, env.rpcConfig.user, env.rpcConfig.password, env.rpcConfig.wallet).listUtxos(address, fromBlock, toBlock)
    }
    return new L1MempoolChainProvider(env.l1Network).listUtxos(address, fromBlock, toBlock)
}

export async function getTransactionStatus(txid: string): Promise<L1TxStatus['status']> {
    if (env.use_rpc) {
        return new L1RPCChainProvider(env.rpcConfig.host, env.rpcConfig.user, env.rpcConfig.password, env.rpcConfig.wallet).getTransactionStatus(txid)
    }
    return new L1MempoolChainProvider(env.l1Network).getTransactionStatus(txid)
}

