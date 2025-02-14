import { L2Address } from "../../../state";
import { L1TxHash } from "../../../state";

export type OffchainDataProvider = {
    getDepositInfo: (txid: L1TxHash) => Promise<{ recipient: L2Address, amount: bigint } | null>;
    setDepositInfo: (txid: L1TxHash, recipient: L2Address, amount: bigint) => Promise<void>;
    getBridgeState: (txid: L1TxHash) => Promise<{ batchesRoot: string, merkleTree: string[], depositAggregatorSPK: string } | null>;
    setBridgeState: (txid: L1TxHash, batchesRoot: string, merkleTree: string[], depositAggregatorSPK: string) => Promise<void>;
    getLatestBridgeTxid: () => Promise<L1TxHash | null>;
    setLatestBridgeTxid: (txid: L1TxHash) => Promise<void>;
}
