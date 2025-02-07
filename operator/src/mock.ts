import { BehaviorSubject, filter, map, Observable, scan, Subject } from 'rxjs';
import {
  BridgeEvent,
  BlockNumberEvent,
  L1TxStatus,
  L2TxStatus,
  TransactionStatus,
  L2TxId,
  L1TxId,
} from './state';

export type AdvanceClock = { type: 'advanceL1BlockNumber'; delta: number };

export type FunctionCall = { type: 'function_call'; call: () => void };

export type MockEvent =
  | BridgeEvent
  | TransactionStatus
  | AdvanceClock
  | FunctionCall;

export type MockedOperatorEnvironment = {
  clock: Observable<BlockNumberEvent>;
  l1Events: Observable<BridgeEvent>;
  l2Events: Observable<BridgeEvent>;
  l1TxStatus: (tx: L1TxId) => Observable<L1TxStatus>;
  l2TxStatus: (tx: L2TxId) => Observable<L2TxStatus>;
  start: () => Promise<void>;
  lastl1Block: BehaviorSubject<number>;
};

export function mocked(events: MockEvent[]): MockedOperatorEnvironment {
  const clock = new Subject<BlockNumberEvent>();
  const l1Events = new Subject<BridgeEvent>();
  const l2Events = new Subject<BridgeEvent>();
  const l1TxStatus = new Subject<L1TxStatus>();
  const l2TxStatus = new Subject<L2TxStatus>();

  let l1BlockNumber = 0;

  async function start() {
    clock.next({ type: 'l1BlockNumber', blockNumber: l1BlockNumber });
    for (const event of events) {
      await sleep(1);
      switch (event.type) {
        case 'advanceL1BlockNumber':
          l1BlockNumber += event.delta;
          break;
        case 'l1BlockNumber':
          throw new Error('Cannot handle blockNumber events!');
        case 'l2BlockNumber':
          throw new Error('Cannot handle blockNumber events!');
        case 'withdrawal':
          l2Events.next(event);
          break;
        case 'closeBatch':
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
        case 'function_call':
          await event.call();
          break;
        default:
          const _exhaustive: never = event;
          return _exhaustive;
      }
      await sleep(1);
      l1BlockNumber += 1;
      if (l1BlockNumber % 5 === 0) {
        clock.next({ type: 'l1BlockNumber', blockNumber: l1BlockNumber });
      }
    }
  }

  const lastl1Block = new BehaviorSubject<number>(0);
  clock.pipe(map((block) => block.blockNumber)).subscribe(lastl1Block);

  return {
    clock,
    l2Events,
    l1Events,
    l1TxStatus: (txId: L1TxId) =>
      l1TxStatus.pipe(filter((tx) => txId.hash === tx.hash)),
    l2TxStatus: (txId: L2TxId) =>
      l2TxStatus.pipe(filter((tx) => txId.hash === tx.hash)),
    start,
    lastl1Block: lastl1Block,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
