import { filter, Observable, Subject } from 'rxjs';
import {
  BridgeEvent,
  ClockEvent,
  L1TxHashAndStatus,
  L2TxHashAndStatus,
  Transaction,
} from './state';

export type MockEvent = {
  delay: number;
  event: BridgeEvent | Transaction | ClockEvent;
};

export type MockedOperatorEnvironment = {
  clock: Observable<ClockEvent>;
  l1Events: Observable<BridgeEvent>;
  l2Events: Observable<BridgeEvent>;
  l1TxStatus: (tx: L1TxHashAndStatus) => Observable<L1TxHashAndStatus>;
  l2TxStatus: (tx: L2TxHashAndStatus) => Observable<L2TxHashAndStatus>;
  start: () => Promise<void>;
};

export function mocked(events: MockEvent[]): MockedOperatorEnvironment {
  const clock = new Subject<ClockEvent>();
  const l1Events = new Subject<BridgeEvent>();
  const l2Events = new Subject<BridgeEvent>();
  const l1TxStatus = new Subject<L1TxHashAndStatus>();
  const l2TxStatus = new Subject<L2TxHashAndStatus>();

  async function start() {
    for (const { delay, event } of events) {
      await sleep(delay);
      switch (event.type) {
        case 'clock':
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

  return {
    clock,
    l2Events,
    l1Events,
    l1TxStatus: (tx: L1TxHashAndStatus) =>
      l1TxStatus.pipe(filter(({ hash }) => tx.hash === hash)),
    l2TxStatus: (tx: L2TxHashAndStatus) =>
      l2TxStatus.pipe(filter(({ hash }) => tx.hash === hash)),
    start,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
