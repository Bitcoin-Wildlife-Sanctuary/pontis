import { L1TxHash, L2Address } from '../../../state';
import { OffchainFileStruct } from './fileOffchainDataProvider';
import { OffchainDataProvider } from './type';

class MemoryOffchainDataProvider implements OffchainDataProvider {
  public data: OffchainFileStruct;

  constructor(initData: OffchainFileStruct) {
    this.data = initData;
  }

  async getDepositInfo(
    txid: L1TxHash
  ): Promise<{ recipient: L2Address; amount: bigint } | null> {
    const info = this.data.depositInfo[txid];
    if (!info) {
      return null;
    }
    return {
      recipient: info.recipient,
      amount: BigInt(info.amount),
    };
  }

  async setDepositInfo(txid: L1TxHash, recipient: L2Address, amount: bigint) {
    this.data.depositInfo[txid] = {
      recipient: recipient,
      amount: amount.toString(),
    };
  }

  async getBridgeState(txid: L1TxHash): Promise<{
    batchesRoot: string;
    merkleTree: string[];
    depositAggregatorSPK: string;
  } | null> {
    return this.data.bridgeState[txid];
  }

  async setBridgeState(
    txid: L1TxHash,
    batchesRoot: string,
    merkleTree: string[],
    depositAggregatorSPK: string
  ) {
    this.data.bridgeState[txid] = {
      batchesRoot: batchesRoot,
      merkleTree: merkleTree,
      depositAggregatorSPK: depositAggregatorSPK,
    };
  }

  async getLatestBridgeTxid(): Promise<L1TxHash> {
    return this.data.latestBridgeTxid;
  }

  async setLatestBridgeTxid(txid: L1TxHash) {
    this.data.latestBridgeTxid = txid;
  }
}

export function createMemoryOffChainDB(): OffchainDataProvider {
  let memoryDB: OffchainFileStruct = {
    depositInfo: {},
    latestBridgeTxid: '',
    bridgeState: {},
  };
  return new MemoryOffchainDataProvider(memoryDB);
}
