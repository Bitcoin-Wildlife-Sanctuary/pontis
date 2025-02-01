import { BehaviorSubject, filter, map, Observable, scan, Subject } from 'rxjs';
import {
  BridgeEvent,
  TickEvent,
  L1TxStatus,
  L2TxStatus,
  TransactionStatus,
  L2TxId,
  L1TxId,
} from './state';

export type AdvanceClock = { type: 'advance_clock'; delta: number };

export type MockEvent = BridgeEvent | TransactionStatus | AdvanceClock;

export type MockedOperatorEnvironment = {
  clock: Observable<TickEvent>;
  l1Events: Observable<BridgeEvent>;
  l2Events: Observable<BridgeEvent>;
  l1TxStatus: (tx: L1TxId) => Observable<L1TxStatus>;
  l2TxStatus: (tx: L2TxId) => Observable<L2TxStatus>;
  start: () => Promise<void>;
  lastTick: BehaviorSubject<number>;
};

export function mocked(events: MockEvent[]): MockedOperatorEnvironment {
  const clock = new Subject<TickEvent>();
  const l1Events = new Subject<BridgeEvent>();
  const l2Events = new Subject<BridgeEvent>();
  const l1TxStatus = new Subject<L1TxStatus>();
  const l2TxStatus = new Subject<L2TxStatus>();

  let timestamp = 0;

  async function start() {
    clock.next({ type: 'tick', timestamp });
    for (const event of events) {
      await sleep(1);
      switch (event.type) {
        case 'advance_clock':
          timestamp += event.delta;
          break;
        case 'tick':
          throw new Error('Cannot handle tick events!');
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
      await sleep(1);
      timestamp += 1;
      clock.next({ type: 'tick', timestamp });
    }
  }

  const lastTick = new BehaviorSubject<number>(0);
  clock.pipe(map((tick) => tick.timestamp)).subscribe(lastTick);

  return {
    clock,
    l2Events,
    l1Events,
    l1TxStatus: (txId: L1TxId) =>
      l1TxStatus.pipe(filter((tx) => txId.hash === tx.hash)),
    l2TxStatus: (txId: L2TxId) =>
      l2TxStatus.pipe(filter((tx) => txId.hash === tx.hash)),
    start,
    lastTick,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
