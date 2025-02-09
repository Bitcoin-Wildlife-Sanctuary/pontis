import { Provider, ReceiptTx, RpcProvider } from 'starknet';
import { L1TxStatus, L2TxStatus, OperatorState } from '../state';
import { filter, from, interval, map, Observable, switchMap } from 'rxjs';

export function l2TransactionStatus<T extends L2TxStatus>(
  provider: RpcProvider,
  tx: T
): Observable<T> {
  return interval(5000).pipe(
    switchMap(() => from(provider.waitForTransaction(tx.hash))),
    map((status) => ({ ...tx, status })),
    filter((recentTx) => recentTx !== tx)
    // finish when tx is accepted
    // takeWhile(tx) => tx.status.statusReceipt
  );
}
