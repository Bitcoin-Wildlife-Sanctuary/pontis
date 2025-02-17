import { RpcProvider } from 'starknet';
import { L2TxStatus } from '../state';
import { filter, from, interval, map, Observable, switchMap, takeWhile } from 'rxjs';

export function l2TransactionStatus<T extends L2TxStatus>(
  provider: RpcProvider,
  tx: T
): Observable<T> {
  return interval(5000).pipe(
    switchMap(() => from(provider.waitForTransaction(tx.hash))),
    map((status) => ({ ...tx, status })),
    filter((recentTx) => recentTx.status !== tx.status),
    takeWhile(tx => tx.status === 'PENDING', true),
  );
}
