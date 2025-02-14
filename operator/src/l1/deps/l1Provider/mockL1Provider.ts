import { L1Provider, Utxo } from "./type";
import { L1TxStatus } from "../../../state";

export class MockL1Provider implements L1Provider {
    private blockNumber = 0;
    private utxos: Utxo[] = [];
    private transactionStatus: L1TxStatus['status'] = 'UNCONFIRMED'
    async getCurrentBlockNumber(): Promise<number> {
        return this.blockNumber++
    }
    setListUtxos(utxos: Utxo[]) {
        this.utxos = utxos
    }
    async listUtxos(_address: string, _fromBlock?: number, _toBlock?: number): Promise<Utxo[]> {
        return this.utxos
    }
    setGetTransactionStatus(status: L1TxStatus['status']) {
        this.transactionStatus = status
    }
    async getTransactionStatus(_txid: string): Promise<L1TxStatus['status']> {
        return this.transactionStatus
    }
}
