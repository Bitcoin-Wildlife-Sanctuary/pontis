import { UTXO } from "scrypt-ts";
import { L1TxStatus } from "../../../state";

export type L1Provider = {
    getCurrentBlockNumber: () => Promise<number>;
    listUtxos: (address: string, fromBlock?: number, toBlock?: number) => Promise<Utxo[]>;
    getTransactionStatus: (txid: string) => Promise<L1TxStatus>;
}

export type Utxo = UTXO & {
    blockNumber: number;
}

export const UNCONFIRMED_BLOCK_NUMBER = -1;
export const DEFAULT_FROM_BLOCK = 0;
export const DEFAULT_TO_BLOCK = 9999999;
