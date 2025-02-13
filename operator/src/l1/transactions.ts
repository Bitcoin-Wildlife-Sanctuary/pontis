import { DepositBatch, L1Tx, L1TxId, L1TxStatus } from '../state';
import { from, interval, Observable, switchMap, takeWhile } from 'rxjs';
import * as l1Api from './api';
import { UNCONFIRMED_BLOCK_NUMBER } from './utils/chain';

export function l1TransactionStatus(
  // add whatever parameters you need
  tx: L1TxId
): Observable<L1TxStatus> {
  return interval(5000).pipe(
    switchMap(() => from(getL1TransactionStatus(tx))),
    takeWhile((tx) => tx.status === 'MINED')
  );
}

async function getL1TransactionStatus(
  tx: L1TxId
  // add whatever parameters you need
): Promise<L1TxStatus> {
  const status = await l1Api.getL1TransactionStatus(tx.hash);
  // console.log(`getL1TransactionStatus(${tx.hash}) status: ${status}`)
  return {
    ...tx,
    status: status,
  };
}

export async function aggregateDeposits(batch: DepositBatch): Promise<L1Tx[]> {
  const txids = await l1Api.aggregateDeposits(batch);
  return txids.map(txid => ({
    type: 'l1tx',
    hash: txid,
    status: 'UNCONFIRMED',
    blockNumber: UNCONFIRMED_BLOCK_NUMBER,
  }));
}

export async function finalizeBatch(batch: DepositBatch): Promise<L1Tx> {
  const txid = await l1Api.finalizeDepositBatchOnL1(batch);
  return {
    type: 'l1tx',
    hash: txid,
    status: 'UNCONFIRMED',
    blockNumber: UNCONFIRMED_BLOCK_NUMBER,
  };
}
