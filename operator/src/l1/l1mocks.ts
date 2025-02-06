import { assert } from 'console';
import { L1Tx, L1TxStatus } from '../state';

export async function aggregateDeposits(txs: L1Tx[]): Promise<L1Tx[]> {
  assert(txs.length % 2 === 0, 'Number of transactions must be even');

  const result: L1Tx[] = [];

  for (let i = 0; i < txs.length; i += 2) {
    result.push({
      type: 'l1tx',
      hash: `0x${txs[i].hash.substring(2)}${txs[i + 1].hash.substring(2)}`,
      status: 'Unconfirmed',
      blockNumber: 0,
    });
  }
  return result;
}

export async function finalizeBatch(tx: L1Tx): Promise<L1Tx> {
  return {
    type: 'l1tx',
    hash: `0xfff${tx.hash.substring(2)}`,
    status: 'Unconfirmed',
    blockNumber: 0,
  };
}
