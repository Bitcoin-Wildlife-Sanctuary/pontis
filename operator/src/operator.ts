import {
  distinctUntilChanged,
  from,
  map,
  merge,
  mergeMap,
  mergeScan,
  Observable,
  of,
  scan,
  Subject,
  tap,
} from 'rxjs';
import {
  applyChange,
  l2EventToEvent,
  l2TxHashAndStatusToTransaction,
  OperatorState,
  Transaction,
} from './state';
import { RpcProvider } from 'starknet';
import { l2Events } from './l2/events';
import { getAllL2Txs, l2TransactionStatus } from './l2/transactions';
import * as _ from 'lodash';

function diff<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const e of a) {
    if (!b.has(e)) {
      result.add(e);
    }
  }
  return result;
}

function mapSet<T, U>(input: Set<T>, fn: (item: T) => U): Set<U> {
  return new Set(Array.from(input, fn));
}

function operatorMain<E, T, S>(
  events: Observable<E>,
  transactions: (state: S) => Set<T>,
  transactionStatus: (tx: T) => Observable<T>,
  applyChange: (state: S, change: E | T) => Observable<S>,
  initialState: S
): Observable<S> {
  const s = new Subject<S>();
  return merge(
    events,
    s.pipe(
      map(transactions),
      scan(
        ([allTxs, _], currentTxs) => [currentTxs, diff(currentTxs, allTxs)],
        [new Set(), new Set()]
      ),
      map(([_, newTxs]) => newTxs),
      mergeMap(from),
      mergeMap(transactionStatus)
    )
  ).pipe(mergeScan(applyChange, initialState, 1), tap(s));
}

function operator(provider: RpcProvider): Observable<OperatorState> {
  const initialState = new OperatorState(); // TODO: load from storage

  const l2BridgeContractAddress = ''; // TODO: add configuration

  return operatorMain(
    // events
    merge(
      l2Events(provider, initialState.l2BlockNumber, [
        l2BridgeContractAddress,
      ]).pipe(map(l2EventToEvent))
      // add l1Events
    ),
    // transactions from state
    (state: OperatorState) => {
      return mapSet(getAllL2Txs(state), l2TxHashAndStatusToTransaction);
      // add l1 transactions
    },
    // transaction status
    (tx: Transaction) => {
      switch (tx.type) {
        case 'l2tx':
          return l2TransactionStatus(provider, tx);
        case 'l1tx':
          throw new Error('not implemented'); // TODO: add l1 transactions
        default:
          const _exhaustive: never = tx;
          return _exhaustive;
      }
    },
    // state transitions
    applyChange,
    // initial state
    initialState
  ).pipe(
    distinctUntilChanged(_.isEqual)
    // TODO: save state to storage
  );
}
