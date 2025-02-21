import { RPCChainProvider, btcRpc } from "l1";
import { L1Provider, Utxo, DEFAULT_FROM_BLOCK, DEFAULT_TO_BLOCK, UNCONFIRMED_BLOCK_NUMBER } from "./type";
import Decimal from 'decimal.js'
import { L1TxStatus } from "../../../state";


export class RPCL1Provider extends RPCChainProvider implements L1Provider {
    async getCurrentBlockNumber(): Promise<number> {
        const data = await btcRpc.rpc_getblockchaininfo(this.url, this.username, this.password)
        return data.blocks
    }
    async listUtxos(address: string, fromBlock?: number, toBlock?: number): Promise<Utxo[]> {
        fromBlock = fromBlock ?? DEFAULT_FROM_BLOCK;
        toBlock = toBlock ?? DEFAULT_TO_BLOCK;
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
    async getTransactionStatus(txid: string): Promise<L1TxStatus> {
        const data = await btcRpc.rpc_gettransaction(this.url, this.username, this.password, this.walletName, txid)
        return {
            type: 'l1tx',
            hash: txid,
            ...data.confirmations > 0 
              ? { status: 'MINED', blockNumber: data.blockheight } 
              : { status: 'UNCONFIRMED'} 
        }
    }
}