import { L2Address } from "../../state";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { L1TxHash } from "../../state";
import * as path from 'path'
type OffChainDB = {
    getDepositInfo: (txid: L1TxHash) => Promise<{recipient: L2Address, amount: bigint} | null>;
    setDepositInfo: (txid: L1TxHash, recipient: L2Address, amount: bigint) => Promise<void>;
    getBridgeState: (txid: L1TxHash) => Promise<{batchesRoot: string, merkleTree: string[], depositAggregatorSPK: string} | null>;
    setBridgeState: (txid: L1TxHash, batchesRoot: string, merkleTree: string[], depositAggregatorSPK: string) => Promise<void>;
    getLatestBridgeTxid: () => Promise<L1TxHash | null>;
    setLatestBridgeTxid: (txid: L1TxHash) => Promise<void>;
}

type Data = {   
    depositInfo: {
        [txid: L1TxHash]: {
            recipient: L2Address;
            amount: string;
        }
    };
    latestBridgeTxid: L1TxHash;
    bridgeState: {
        [txid: L1TxHash]: {
            batchesRoot: string;
            merkleTree: string[];
            depositAggregatorSPK: string;
        }
    }
}
const jsonPath = path.join(__dirname, 'offchain_db.json');

async function getDepositInfo(txid: L1TxHash): Promise<{recipient: L2Address, amount: bigint} | null> {
    const data: Data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const info = data.depositInfo[txid];
    if (!info) {
        return null;
    }
    return {
        recipient: info.recipient,
        amount: BigInt(info.amount)
    }
}

async function setDepositInfo(txid: L1TxHash, recipient: L2Address, amount: bigint) {
    const data: Data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    data.depositInfo[txid] = {
        recipient: recipient,
        amount: amount.toString()
    };
    writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}


async function setBridgeState(txid: L1TxHash, batchesRoot: string, merkleTree: string[], depositAggregatorSPK: string) {
    const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    data.bridgeState[txid] = {
        batchesRoot: batchesRoot,
        merkleTree: merkleTree,
        depositAggregatorSPK: depositAggregatorSPK
    };
    writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

async function getBridgeState(txid: L1TxHash): Promise<{batchesRoot: string, merkleTree: string[], depositAggregatorSPK: string} | null> {
    const data: Data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const state = data.bridgeState[txid];
    if (!state) {
        return null;
    }
    return {
        batchesRoot: state.batchesRoot,
        merkleTree: state.merkleTree,
        depositAggregatorSPK: state.depositAggregatorSPK
    }
}

async function getLatestBridgeTxid(): Promise<L1TxHash> {
    const data: Data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    return data.latestBridgeTxid;
}

async function setLatestBridgeTxid(txid: L1TxHash) {
    const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    data.latestBridgeTxid = txid;
    writeFileSync(jsonPath, JSON.stringify(data, null, 2));
}

export function createDbFile() {
    if (existsSync(jsonPath)) {
        return;
    }
    writeFileSync(jsonPath, JSON.stringify({
        depositInfo: {},
        latestBridgeTxid: '',
        bridgeState: {}
    }, null, 2));
}

export function getOffChainDB(): OffChainDB {
    return {
        getDepositInfo,
        setDepositInfo,
        getBridgeState,
        setBridgeState,
        getLatestBridgeTxid,
        setLatestBridgeTxid
    }
}