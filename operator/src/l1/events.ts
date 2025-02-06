import {
  distinctUntilChanged,
  from,
  map,
  interval,
  Observable,
  switchMap,
  scan,
} from 'rxjs';
import { BlockNumberEvent, Deposits } from '../state';

const POLL_INTERVAL = 5000;

export function l1BlockNumber(): Observable<BlockNumberEvent> {
  return currentBlock().pipe(
    map((blockNumber) => ({ type: 'l1BlockNumber', blockNumber }))
  );
}

function currentBlock(): Observable<number> {
  return interval(POLL_INTERVAL).pipe(
    switchMap(() => from(getCurrentL1BlockNumber())),
    distinctUntilChanged()
  );
}

export function currentBlockRange(
  initialBlockNumber: number
): Observable<[number, number]> {
  return currentBlock().pipe(
    scan(
      ([_, previous], current) => [previous + 1, current],
      [0, initialBlockNumber]
    )
  );
}

export function deposits(initialBlockNumber: number): Observable<Deposits> {
  return currentBlockRange(initialBlockNumber).pipe(
    switchMap(([previous, current]) => from(depositsInRange(previous, current)))
  );
}

// functions to be implemented
// add whatever parameters you need
function getCurrentL1BlockNumber(): Promise<number> {
  throw new Error('Not implemented');
}

function depositsInRange(previous: number, current: number): Promise<Deposits> {
  throw new Error('Not implemented.');
}
