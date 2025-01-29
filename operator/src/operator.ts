import {
  asapScheduler,
  asyncScheduler,
  BehaviorSubject,
  distinctUntilChanged,
  from,
  map,
  merge,
  mergeMap,
  mergeScan,
  Observable,
  observeOn,
  of,
  pipe,
  scan,
  shareReplay,
  Subject,
  tap,
  timer,
  UnaryFunction,
} from 'rxjs';
import {
  applyChange,
  BridgeEvent,
  ClockEvent,
  L1TxHashAndStatus,
  l2EventToEvent,
  L2TxHashAndStatus,
  OperatorState,
  Transaction,
} from './state';
import { RpcProvider } from 'starknet';
import { L2Event, l2Events } from './l2/events';
import {
  getAllL1Txs,
  getAllL2Txs,
  l2TransactionStatus,
} from './l2/transactions';
import * as _ from 'lodash';
import { isEqual } from 'lodash';

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

function stateToTransactions<S, T>(
  transactionsFromState: (state: S) => Set<T>,
  transactionStatus: (tx: T) => Observable<T>
) {
  return pipe(
    map(transactionsFromState),
    scan(
      ([allTxs, _], currentTxs) => [currentTxs, diff(currentTxs, allTxs)],
      [new Set<T>(), new Set<T>()]
    ),
    map(([_, newTxs]) => newTxs),
    mergeMap((txs) => from(txs)),
    mergeMap(transactionStatus)
  );
}

function operatorLoop<C, E, T, S>(
  clock: Observable<C>,
  events: Observable<E>,
  transactionsFromState: (state: S) => Set<T>,
  transactionStatus: (tx: T) => Observable<T>,
  applyChange: (state: S, change: C | E | T) => Observable<S>,
  initialState: S
): Observable<S> {
  const state = new BehaviorSubject<S>(initialState);
  const transactions = state.pipe(
    stateToTransactions(transactionsFromState, transactionStatus)
  );
  return merge(clock, events, transactions).pipe(
    mergeScan(applyChange, initialState, 1),
    tap(state)
  );
}

export function clock(): Observable<ClockEvent> {
  return timer(0, 1000).pipe(
    map(() => Date.now()),
    map((timestamp) => ({ type: 'clock', timestamp }))
  );
}

export function setupOperator(
  initialState: OperatorState,
  clock: Observable<ClockEvent>,
  l1Events: Observable<BridgeEvent>,
  l2Events: Observable<BridgeEvent>,
  l1TxStatus: (tx: L1TxHashAndStatus) => Observable<L1TxHashAndStatus>,
  l2TxStatus: (tx: L2TxHashAndStatus) => Observable<L2TxHashAndStatus>,
  saveState: (state: OperatorState) => void
): Observable<OperatorState> {
  function transactionsFromState(state: OperatorState): Set<Transaction> {
    return new Set([...getAllL1Txs(state), ...getAllL2Txs(state)]);
  }

  function transactionStatus(tx: Transaction): Observable<Transaction> {
    switch (tx.type) {
      case 'l1tx':
        return l1TxStatus(tx);
      case 'l2tx':
        return l2TxStatus(tx);
      default:
        const _exhaustive: never = tx;
        return _exhaustive;
    }
  }

  return operatorLoop(
    clock,
    merge(l1Events, l2Events),
    transactionsFromState,
    transactionStatus,
    applyChange,
    initialState
  ).pipe(distinctUntilChanged(isEqual), tap(saveState));
}
