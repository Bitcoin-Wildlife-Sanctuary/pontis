import { BehaviorSubject, filter, map, Observable, Subject } from 'rxjs';
import {
  BridgeEvent,
  TickEvent,
  L1TxHashAndStatus,
  L2TxHashAndStatus,
  Transaction,
} from './state';

export type MockEvent = {
  delay: number;
  event: BridgeEvent | Transaction | TickEvent;
};

export type MockedOperatorEnvironment = {
  clock: Observable<TickEvent>;
  l1Events: Observable<BridgeEvent>;
  l2Events: Observable<BridgeEvent>;
  l1TxStatus: (tx: L1TxHashAndStatus) => Observable<L1TxHashAndStatus>;
  l2TxStatus: (tx: L2TxHashAndStatus) => Observable<L2TxHashAndStatus>;
  start: () => Promise<void>;
  lastTick: BehaviorSubject<number>;
  lastL1BlockNumber: BehaviorSubject<number>;
};

export function mocked(events: MockEvent[]): MockedOperatorEnvironment {
  const clock = new Subject<TickEvent>();
  const l1Events = new Subject<BridgeEvent>();
  const l2Events = new Subject<BridgeEvent>();
  const l1TxStatus = new Subject<L1TxHashAndStatus>();
  const l2TxStatus = new Subject<L2TxHashAndStatus>();

  async function start() {
    for (const { delay, event } of events) {
      await sleep(delay);
      switch (event.type) {
        case 'tick':
          clock.next(event);
          break;
        case 'l2event':
          l2Events.next(event);
          break;
        case 'deposits':
          l1Events.next(event);
          break;
        case 'l1tx':
          l1TxStatus.next(event);
          break;
        case 'l2tx':
          l2TxStatus.next(event);
          break;
        default:
          const _exhaustive: never = event;
          return _exhaustive;
      }
    }
    await sleep(1000);
  }

  const lastTick = new BehaviorSubject<number>(0);
  clock.pipe(map((tick) => tick.timestamp)).subscribe(lastTick);

  const lastL1BlockNumber = new BehaviorSubject<number>(0);
  l1TxStatus.pipe(map((tx) => tx.blockNumber)).subscribe(lastL1BlockNumber);

  return {
    clock,
    l2Events,
    l1Events,
    l1TxStatus: (initialTx: L1TxHashAndStatus) =>
      l1TxStatus.pipe(
        filter((tx) => initialTx.hash === tx.hash),
        map((tx) => ({
          ...tx,
          blockNumber: initialTx.blockNumber,
          timestamp: initialTx.timestamp,
        }))
      ),
    l2TxStatus: (initialTx: L2TxHashAndStatus) =>
      l2TxStatus.pipe(filter((tx) => initialTx.hash === tx.hash)),
    start,
    lastTick,
    lastL1BlockNumber,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
