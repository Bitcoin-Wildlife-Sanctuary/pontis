import { RpcProvider } from 'starknet';
import { L2TxId, L2TxStatus } from '../state';
import {
  distinctUntilKeyChanged,
  from,
  map,
  mergeMap,
  Observable,
  switchMap,
  takeWhile,
  tap,
  timer,
} from 'rxjs';

async function getL2TransactionStatus(
  provider: RpcProvider,
  tx: L2TxId
): Promise<L2TxStatus> {
  const receipt = await provider.waitForTransaction(tx.hash);
  const result: L2TxStatus = {
    ...tx,
    status: receipt.isSuccess()
      ? 'SUCCEEDED'
      : receipt.isReverted()
        ? 'REVERTED'
        : receipt.isRejected()
          ? 'REJECTED'
          : 'ERROR',
  };
  return result;
}

export function l2TransactionStatus(
  provider: RpcProvider,
  tx: L2TxId
): Observable<L2TxStatus> {
  return timer(0, 5000).pipe(
    mergeMap(() => from(getL2TransactionStatus(provider, tx)), 1),
    distinctUntilKeyChanged('status'),
    takeWhile((tx) => tx.status === 'PENDING', true)
  );
}
