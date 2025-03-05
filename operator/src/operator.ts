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
} from 'rxjs';
import {
  BridgeEvent,
  BlockNumberEvent,
  getAllL1Txs,
  L1TxStatus,
  L2TxStatus,
  OperatorChange,
  OperatorState,
  TransactionStatus,
  BridgeEnvironment,
  TransactionId,
  L2TxId,
  L1TxId,
  getAllL2Txs,
} from './state';
import { isEqual } from 'lodash';

function diff<TI>(a: TI[], b: TI[]): TI[] {
  const result = [];
  for (const e of a) {
    if (!b.find((x) => isEqual(x, e))) {
      result.push(e);
    }
  }
  return result;
}

function stateToTransactions<S, TI, TS>(
  transactionsFromState: (state: S) => TI[],
  transactionStatus: (tx: TI) => Observable<TS>
) {
  return pipe(
    map(transactionsFromState),
    scan(
      ([previousAllTxs, _]: TI[][], currentAllTxs: TI[]) => [
        currentAllTxs,
        diff(currentAllTxs, previousAllTxs),
      ],
      [[], []]
    ),
    map(([_, newTxs]) => newTxs),
    mergeMap((txs) => from(txs)),
    mergeMap(transactionStatus)
  );
}

function operatorLoop<E, TI, TS, S>(
  events: Observable<E>,
  transactionsFromState: (state: S) => TI[],
  transactionStatus: (tx: TI) => Observable<TS>,
  eventsFromState: (state: Observable<S>) => Observable<E>,
  applyChange: (state: S, change: E | TS) => Observable<S>,
  initialState: S
): Observable<S> {
  const state = new BehaviorSubject<S>(initialState);
  const transactions = state.pipe(
    stateToTransactions(transactionsFromState, transactionStatus)
  );
  const stateEvents = eventsFromState(state);
  return merge(events, stateEvents, transactions).pipe(
    mergeScan(applyChange, initialState, 1),
    tap(state)
  );
}

export function setupOperator(
  initialState: OperatorState,
  environment: BridgeEnvironment,
  block: Observable<BlockNumberEvent>,
  l1Events: Observable<BridgeEvent>,
  l2Events: Observable<BridgeEvent>,
  l1TxStatus: (tx: L1TxId) => Observable<L1TxStatus>,
  l2TxStatus: (tx: L2TxId) => Observable<L2TxStatus>,
  eventsFromState: (
    state: Observable<OperatorState>
  ) => Observable<BridgeEvent>,
  applyChange: (
    environment: BridgeEnvironment,
    state: OperatorState,
    change: OperatorChange
  ) => Promise<OperatorState>,
  saveState: (state: OperatorState) => void
): Observable<OperatorState> {
  function transactionsFromState(state: OperatorState): TransactionId[] {
    return [...getAllL1Txs(state), ...getAllL2Txs(state)];
  }

  function transactionStatus(tx: TransactionId): Observable<TransactionStatus> {
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
    merge(block, l1Events, l2Events),
    transactionsFromState,
    transactionStatus,
    eventsFromState,
    (state: OperatorState, change: OperatorChange) =>
      from(applyChange(environment, state, change)),
    initialState
  ).pipe(distinctUntilChanged(isEqual), tap(saveState));
}
