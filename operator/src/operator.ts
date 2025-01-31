import {
  BehaviorSubject,
  distinctUntilChanged,
  from,
  map,
  merge,
  mergeMap,
  mergeScan,
  Observable,
  pipe,
  scan,
  tap,
  timer,
} from 'rxjs';
import {
  BridgeEvent,
  TickEvent,
  getAllL1Txs,
  L1TxHashAndStatus,
  L2TxHashAndStatus,
  OperatorChange,
  OperatorState,
  Transaction,
  BridgeEnvironment,
} from './state';
import { difference, isEqual, some } from 'lodash';
import { deepEqual } from 'assert';

function diff<T>(a: T[], b: T[]): T[] {
  const result = [];
  for (const e of a) {
    if (!b.find((x) => isEqual(x, e))) {
      result.push(e);
    }
  }
  return result;
}

function stateToTransactions<S, T>(
  transactionsFromState: (state: S) => T[],
  transactionStatus: (tx: T) => Observable<T>
) {
  return pipe(
    map(transactionsFromState),
    scan(
      ([previousAllTxs, _]: T[][], currentAllTxs: T[]) => [
        currentAllTxs,
        diff(currentAllTxs, previousAllTxs),
      ],
      [[], []]
    ),
    // tap(([allTxs, newTxs]) => console.log('all:', allTxs, 'new:', newTxs)),
    map(([_, newTxs]) => newTxs),
    mergeMap((txs) => from(txs)),
    mergeMap(transactionStatus)
  );
}

function operatorLoop<E, T, S>(
  events: Observable<E>,
  transactionsFromState: (state: S) => T[],
  transactionStatus: (tx: T) => Observable<T>,
  applyChange: (state: S, change: E | T) => Observable<S>,
  initialState: S
): Observable<S> {
  const state = new BehaviorSubject<S>(initialState);
  const transactions = state.pipe(
    stateToTransactions(transactionsFromState, transactionStatus)
  );
  return merge(events, transactions).pipe(
    tap((change) => console.log('change:', change)),
    mergeScan(applyChange, initialState),
    tap((state) => {
      console.log('state:');
      console.dir(state, { depth: null });
    }),
    tap(state)
  );
}

export function clock(): Observable<TickEvent> {
  return timer(0, 1000).pipe(
    map(() => Date.now()),
    map((timestamp) => ({ type: 'tick', timestamp }))
  );
}

export function setupOperator(
  initialState: OperatorState,
  environment: BridgeEnvironment,
  clock: Observable<TickEvent>,
  l1Events: Observable<BridgeEvent>,
  l2Events: Observable<BridgeEvent>,
  l1TxStatus: (tx: L1TxHashAndStatus) => Observable<L1TxHashAndStatus>,
  l2TxStatus: (tx: L2TxHashAndStatus) => Observable<L2TxHashAndStatus>,
  applyChange: (
    environment: BridgeEnvironment,
    state: OperatorState,
    change: OperatorChange
  ) => Promise<OperatorState>,
  saveState: (state: OperatorState) => void
): Observable<OperatorState> {
  function transactionsFromState(state: OperatorState): Transaction[] {
    return [...getAllL1Txs(state) /*...getAllL2Txs(state) */];
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
    merge(clock, l1Events, l2Events),
    transactionsFromState,
    transactionStatus,
    (state: OperatorState, change: OperatorChange) =>
      from(applyChange(environment, state, change)),
    initialState
  ).pipe(distinctUntilChanged(isEqual), tap(saveState));
}
