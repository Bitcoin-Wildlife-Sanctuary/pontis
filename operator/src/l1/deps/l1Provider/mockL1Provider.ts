import { DEFAULT_TO_BLOCK, L1Provider, Utxo } from "./type";
import { L1TxStatus } from "../../../state";
import { Transaction } from "@scrypt-inc/bitcoinjs-lib";
import { utils } from "l1";

export class MockL1Provider implements L1Provider {
    private blockNumber = 0;
    private utxos: Utxo[] = [];
    private transactionStatus: L1TxStatus['status'] = 'UNCONFIRMED'

    async getCurrentBlockNumber(): Promise<number> {
        return this.blockNumber
    }

    setCurrentBlockNumber(blockNumber: number) {
        this.blockNumber = blockNumber
    }

    setListUtxos(utxos: Utxo[]) {
        this.utxos = utxos
    }
    setListUtxosByRawTxs(rawTxs: string[], blockNumber?: number) {
        this.utxos = [];
        const txs = rawTxs.map(rawTx => Transaction.fromHex(rawTx))

        if (typeof blockNumber === 'undefined') {
            blockNumber = this.blockNumber
        }

        txs.forEach(tx => {
            tx.outs.forEach((output, index) => {
                const script = Buffer.from(output.script).toString('hex')
                if (!utils.isP2trScript(script)) return
                this.utxos.push({
                    txId: tx.getId(),
                    outputIndex: index,
                    satoshis: Number(output.value),
                    address: utils.p2trLockingScriptToAddr(script),
                    script: script,
                    blockNumber: blockNumber,
                })
            })
        })
    }
    async listUtxos(address: string, fromBlock?: number, toBlock?: number): Promise<Utxo[]> {
        fromBlock = fromBlock ?? -1;
        toBlock = toBlock ?? DEFAULT_TO_BLOCK;  
        return this.utxos.filter(utxo => utxo.blockNumber >= fromBlock && utxo.blockNumber <= toBlock && utxo.address === address)
    }
    setGetTransactionStatus(status: L1TxStatus['status']) {
        this.transactionStatus = status
    }
    async getTransactionStatus(_txid: string): Promise<L1TxStatus> {
        if (this.transactionStatus === 'MINED') {
            return {
                type: 'l1tx',
                hash: _txid,
                status: this.transactionStatus,
                blockNumber: this.blockNumber
            }
        } else {
            return {
                type: 'l1tx',
                hash: _txid,
                status: this.transactionStatus
            }
        }
    }
}
