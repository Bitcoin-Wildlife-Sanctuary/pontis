
import { L2Address, L1TxHash } from "../../../state";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import * as path from 'path'
import { OffchainDataProvider } from "./type";

export type OffchainFileStruct = {
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

function createDbFile(jsonPath: string) {
    if (existsSync(jsonPath)) {
        return;
    }
    writeFileSync(jsonPath, JSON.stringify({
        depositInfo: {},
        latestBridgeTxid: '',
        bridgeState: {}
    }, null, 2));
}


export class FileOffChainDataProvider implements OffchainDataProvider {
    private jsonPath: string;

    constructor(jsonPath: string) {
        this.jsonPath = jsonPath;
        createDbFile(jsonPath);
    }

    async getDepositInfo(txid: L1TxHash): Promise<{ recipient: L2Address, amount: bigint } | null> {
        const data: OffchainFileStruct = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
        const info = data.depositInfo[txid];
        if (!info) {
            return null;
        }
        return {
            recipient: info.recipient,
            amount: BigInt(info.amount)
        }
    }

    async setDepositInfo(txid: L1TxHash, recipient: L2Address, amount: bigint) {
        const data: OffchainFileStruct = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
        data.depositInfo[txid] = {
            recipient: recipient,
            amount: amount.toString()
        };
        writeFileSync(this.jsonPath, JSON.stringify(data, null, 2));
    }


    async setBridgeState(txid: L1TxHash, batchesRoot: string, merkleTree: string[], depositAggregatorSPK: string) {
        const data: OffchainFileStruct = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
        data.bridgeState[txid] = {
            batchesRoot: batchesRoot,
            merkleTree: merkleTree,
            depositAggregatorSPK: depositAggregatorSPK
        };
        writeFileSync(this.jsonPath, JSON.stringify(data, null, 2));
    }


    async getBridgeState(txid: L1TxHash): Promise<{ batchesRoot: string, merkleTree: string[], depositAggregatorSPK: string } | null> {
        const data: OffchainFileStruct = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
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


    async getLatestBridgeTxid(): Promise<L1TxHash> {
        const data: OffchainFileStruct = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
        return data.latestBridgeTxid;
    }


    async setLatestBridgeTxid(txid: L1TxHash) {
        const data: OffchainFileStruct = JSON.parse(readFileSync(this.jsonPath, 'utf8'));
        data.latestBridgeTxid = txid;
        writeFileSync(this.jsonPath, JSON.stringify(data, null, 2));
    }

}

export function getFileOffChainDataProvider(): OffchainDataProvider {
    const jsonPath = path.join(__dirname, 'offchain_db.json');
    createDbFile(jsonPath);
    return new FileOffChainDataProvider(jsonPath);
}