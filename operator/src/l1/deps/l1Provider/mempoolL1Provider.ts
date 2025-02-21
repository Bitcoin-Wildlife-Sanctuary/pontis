import { L1Provider, Utxo, DEFAULT_FROM_BLOCK, DEFAULT_TO_BLOCK, UNCONFIRMED_BLOCK_NUMBER } from "./type";
import { MempoolChainProvider } from "l1";
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib'
import { utils } from "l1";
import fetch from 'cross-fetch'
import { L1TxStatus } from "../../../state";

export class MempoolL1Provider extends MempoolChainProvider implements L1Provider {
    async getCurrentBlockNumber(): Promise<number> {
        const res = await fetch(`${this.getMempoolApiHost()}/api/blocks/tip/height`)
        const data = await res.text()
        if (res.status !== 200) {
            throw new Error(`Failed to get current block number: status: ${res.status}, body: ${data}`)
        }
        return parseInt(data)
    }
    async listUtxos(address: string, fromBlock?: number, toBlock?: number): Promise<Utxo[]> {
        fromBlock = fromBlock ?? DEFAULT_FROM_BLOCK;
        toBlock = toBlock ?? DEFAULT_TO_BLOCK;
        
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
    async getTransactionStatus(txid: string): Promise<L1TxStatus> {
        const res = await fetch(`${this.getMempoolApiHost()}/api/tx/${txid}`)
        if (res.status === 404) {
            return {
                type: 'l1tx',
                hash: txid,
                status: 'DROPPED',
            }
        }
        if (res.status !== 200) {
            throw new Error(`Failed to get transaction status: status: ${res.status}, body: ${await res.text()}`)
        }
        const data = await res.json()
        if (data.status.confirmed) {
            return {
                type: 'l1tx',
                hash: txid,
                status: 'MINED',
                blockNumber: data.status.block_height,
            }
        }
        return {
            type: 'l1tx',
            hash: txid,
            status: 'UNCONFIRMED',
        }
    }
    
}


