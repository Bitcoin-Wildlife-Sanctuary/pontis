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
  Deposit,
  L1TxHashAndStatus,
  L2TxHashAndStatus,
  OperatorState,
} from './l2/state';
import { RpcProvider, TransactionStatus } from 'starknet';
import { L2Event, l2Events } from './l2/events';
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

type Event =
  | ({ type: 'l2event' } & L2Event)
  | ({ type: 'deposits' } & Deposit[]); // add blocknumber, etc

type Transaction =
  | ({ type: 'l2tx' } & L2TxHashAndStatus)
  | ({ type: 'l1tx' } & L1TxHashAndStatus);

function applyChange(
  state: OperatorState,
  change: Event | Transaction
): Observable<OperatorState> {
  // TODO ...
  return of();
}

function l2TxHashAndStatusToTransaction(tx: L2TxHashAndStatus): Transaction {
  return { type: 'l2tx', ...tx };
}

function l2EventToEvent(e: L2Event): Event {
  return { type: 'l2event', ...e };
}

function operator(provider: RpcProvider): Observable<OperatorState> {
  const initialState = new OperatorState(); // load from storage

  const l2BridgeContractAddress = '';

  provider.waitForTransaction;

  return operatorMain(
    // events
    merge(
      l2Events(provider, initialState.l2BlockNumber, [
        l2BridgeContractAddress,
      ]).pipe(map(l2EventToEvent))
      // add l1Events
    ),
    (state: OperatorState) => {
      return mapSet(getAllL2Txs(state), l2TxHashAndStatusToTransaction);
      // add l1 transactions
    },
    (tx: Transaction) => {
      switch (tx.type) {
        case 'l2tx':
          return l2TransactionStatus(provider, tx);
        case 'l1tx':
          throw new Error('not implemented'); // add l1 transactions
        default:
          const _exhaustive: never = tx;
          return _exhaustive;
      }
    },
    applyChange,
    initialState
  ).pipe(
    distinctUntilChanged(_.isEqual)
    //save state to storage
  );
}
