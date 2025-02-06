import { L1Tx, L1TxId, L1TxStatus } from '../state';
import { from, interval, Observable, switchMap, takeWhile } from 'rxjs';

export function l1TransactionStatus(
  // add whatever parameters you need
  tx: L1TxId
): Observable<L1TxStatus> {
  return interval(5000).pipe(
    switchMap(() => from(getL1TransactionStatus(tx))),
    takeWhile((tx) => tx.status === 'Mined')
  );
}

function getL1TransactionStatus(
  tx: L1TxId
  // add whatever parameters you need
): Promise<L1TxStatus> {
  throw new Error('Not implemented');
}

export async function aggregateDeposits(txs: L1Tx[]): Promise<L1Tx[]> {
  throw new Error('Not implemented');
}

export async function finalizeBatch(tx: L1Tx): Promise<L1Tx> {
  throw new Error('Not implemented');
}
