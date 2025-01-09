import { Provider, ReceiptTx, RpcProvider } from 'starknet';
import { L2TxHashAndStatus, OperatorState } from '../state';
import { filter, from, interval, map, Observable, switchMap } from 'rxjs';

export function getAllL2Txs(state: OperatorState): Set<L2TxHashAndStatus> {
  const results: Set<L2TxHashAndStatus> = new Set();

  for (const depositBatch of state.depositBatches) {
    switch (depositBatch.status) {
      case 'SUBMITTED_TO_L2':
        results.add(depositBatch.depositTx);
        break;
      // default:
      //   break;
    }
  }

  for (const withdrawalBatch of state.withdrawalBatches) {
    switch (withdrawalBatch.status) {
      case 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED':
        results.add(withdrawalBatch.closeWithdrawalBatchTx);
        break;
      default:
        break;
    }
  }
  return results;
}

export function l2TransactionStatus<T extends L2TxHashAndStatus>(
  provider: RpcProvider,
  tx: T
): Observable<T> {
  return interval(5000).pipe(
    switchMap(() => from(provider.waitForTransaction(tx.hash))),
    map((status) => ({ ...tx, status })),
    filter((recentTx) => recentTx != tx)
    // finish when tx is accepted
    // takeWhile(tx) => tx.status.statusReceipt
  );
}
