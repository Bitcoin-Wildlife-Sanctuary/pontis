import { assert } from 'console';
import { L1TxHashAndStatus } from '../state';

export async function aggregateDeposits(
  txs: L1TxHashAndStatus[],
  // parameters below necessary only for the mock
  currentBlockNumber: number,
  currentTimestamp: number
): Promise<L1TxHashAndStatus[]> {
  assert(txs.length % 2 === 0, 'Number of transactions must be even');

  const result: L1TxHashAndStatus[] = [];

  for (let i = 0; i < txs.length; i += 2) {
    result.push({
      type: 'l1tx',
      hash: `0x${txs[i].hash.substring(2)}${txs[i + 1].hash.substring(2)}`,
      status: 'Unconfirmed',
      blockNumber: currentBlockNumber + 1,
      timestamp: currentTimestamp,
    });
  }
  return result;
}

export async function finalizeBatch(
  tx: L1TxHashAndStatus,
  // parameters below necessary only for the mock
  currentBlockNumber: number,
  currentTimestamp: number
): Promise<L1TxHashAndStatus> {
  return {
    type: 'l1tx',
    hash: `0xfff${tx.hash}`,
    status: 'Unconfirmed',
    blockNumber: currentBlockNumber + 1,
    timestamp: currentTimestamp,
  };
}
