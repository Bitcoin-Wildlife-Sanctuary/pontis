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
  switchScan,
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

function diff<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();

  for (const e of a) {
    if (!b.has(e)) {
      result.add(e);
    }
  }

  return result;
}

function operatorMain<E, T, S>(
  events: Observable<E>,
  transactions: (state: S) => Set<T>,
  transactionStatus: (tx: T) => Observable<T>,
  process: (state: S, input: E | T) => Observable<S>,
  initialState: S
) {
  const s = new Subject<S>();
  return merge(
    events,
    s
      .pipe(
        map(transactions),
        scan(diff, new Set()),
        mergeMap(from),
        mergeMap(transactionStatus)
      )
      .pipe(mergeScan(process, initialState, 1), tap(s))
  );
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

function operator(provider: RpcProvider) {
  const initialState = new OperatorState(); // load from storage

  const l2BridgeContractAddress = '';

  provider.waitForTransaction;

  return operatorMain(
    merge(
      l2Events(provider, initialState.l2BlockNumber, [l2BridgeContractAddress])
      // add l1Events
    ),
    (state: OperatorState) => {
      return getAllL2Txs(state);
      // add l2 transactions
    },
    (tx) => l2TransactionStatus(provider, tx), // add l1 transactions
    applyChange,
    initialState
  ).pipe(
    distinctUntilChanged()
    //save state to storage
  );
}
