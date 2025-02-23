import { assert } from 'console';
import { L1Tx, L1TxStatus, DepositBatch } from '../state';

export async function aggregateDeposits(
  batch: DepositBatch
): Promise<{ txs: L1Tx[]; replace: boolean }> {
  assert(
    batch.deposits.length % 2 === 0,
    'Number of transactions must be even'
  );

  const result: L1Tx[] = [];
  return {
    txs: result,
    replace: false,
  };
}

export async function finalizeBatch(batch: DepositBatch): Promise<L1Tx> {
  return {
    type: 'l1tx',
    hash: `0xfff`,
    status: 'UNCONFIRMED',
  };
}
