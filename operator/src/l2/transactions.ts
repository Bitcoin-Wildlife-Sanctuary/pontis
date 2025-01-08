import { Provider, RpcProvider } from 'starknet';
import { L2TxHashAndStatus, OperatorState } from './state';
import {
  filter,
  from,
  interval,
  map,
  Observable,
  switchMap,
  takeWhile,
} from 'rxjs';

export function getAllL2Txs(state: OperatorState): Set<L2TxHashAndStatus> {
  const results: Set<L2TxHashAndStatus> = new Set();

  for (const depositBatch of state.depositBatches) {
    switch (depositBatch.status) {
      case 'BEING_AGGREGATED':
      case 'AGGREGATED':
        break;
      case 'SUBMITTED_TO_L2':
      case 'DEPOSITED':
      case 'SUBMITTED_FOR_VERIFICATION':
      case 'VERIFIED':
        results.add(depositBatch.l2Tx);
        break;
      default:
        // Exhaustive check — if you add a new `status` later, TypeScript will error
        const _exhaustive: never = depositBatch;
        return _exhaustive;
    }
  }

  for (const withdrawalBatch of state.withdrawalBatches) {
    switch (withdrawalBatch.status) {
      case 'PENDING':
        break;
      case 'CLOSE_SUBMITTED':
      case 'CLOSED':
      case 'SUBMITTED_FOR_VERIFICATION':
      case 'BEING_EXPANDED':
      case 'EXPANDED':
        results.add(withdrawalBatch.l2Tx);
        break;

      default:
        const _exhaustive: never = withdrawalBatch;
        return _exhaustive;
    }
  }
  return results;
}

export function l2TransactionStatus(
  provider: RpcProvider,
  tx: L2TxHashAndStatus
): Observable<L2TxHashAndStatus> {
  return interval(5000).pipe(
    switchMap(() => from(provider.waitForTransaction(tx.hash))),
    map((status) => ({ ...tx, status: status })),
    filter((recentTx) => recentTx != tx)
    // finish when tx is accepted
    // takeWhile(tx) => tx.status.statusReceipt
  );
}
