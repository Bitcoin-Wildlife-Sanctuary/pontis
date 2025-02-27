import { Provider, events, CallData, ParsedEvent } from 'starknet';
import { EMPTY, Observable, from, timer } from 'rxjs';
import {
  switchMap,
  scan,
  distinctUntilChanged,
  mergeMap,
  map,
} from 'rxjs/operators';
import {
  EMITTED_EVENT,
  EVENT,
} from 'starknet-types-07/dist/types/api/components';
import { BlockNumberEvent, L1Address, L2TxHash } from '../state';
import { fromDigest, wordSpanToHex } from './contracts';

const POLL_INTERVAL = 5000;
const CHUNK_SIZE = 10;

export function currentBlock(provider: Provider): Observable<number> {
  return timer(0, POLL_INTERVAL).pipe(
    switchMap(async () => (await provider.getBlock('latest')).block_number),
    distinctUntilChanged()
  );
}

export function currentBlockRange(
  provider: Provider,
  initialBlockNumber: number
): Observable<[number, number]> {
  return currentBlock(provider).pipe(
    scan(
      ([_, previous], current) => [previous + 1, current],
      [0, initialBlockNumber]
    )
  );
}

// TODO: add memoize
async function eventParser(
  provider: Provider,
  contractAddress: string
): Promise<(rawEvent: EMITTED_EVENT) => ParsedEvent> {
  const { abi } = await provider.getClassAt(contractAddress);
  if (abi === undefined) {
    throw 'no abi';
  }

  const abiEvents = events.getAbiEvents(abi);
  const abiStructs = CallData.getAbiStruct(abi);
  const abiEnums = CallData.getAbiEnum(abi);

  return (rawEvent: EMITTED_EVENT) =>
    events.parseEvents([rawEvent], abiEvents, abiStructs, abiEnums)[0];
}

type L2EventCommon = {
  blockNumber: number;
  origin: L2TxHash;
};

export type L2Event = (
  | {
      type: 'withdrawal';
      id: bigint;
      amount: bigint;
      recipient: L1Address;
    }
  | {
      type: 'closeBatch';
      id: bigint;
      root: string;
    }
) &
  L2EventCommon;

function contractEventsInRange(
  provider: Provider,
  contractAddress: string,
  from: number,
  to: number
) {
  return new Observable<L2Event>((subscriber) => {
    async function getEvents() {
      const parseEvents = await eventParser(provider, contractAddress);

      try {
        let continuationToken: string | undefined = undefined;
        do {
          const response = await provider.getEvents({
            address: contractAddress,
            from_block: { block_number: from },
            to_block: { block_number: to },
            chunk_size: CHUNK_SIZE,
            continuation_token: continuationToken,
          });

          const events = response.events;
          for (const rawEvent of events) {
            const blockNumber = rawEvent.block_number;
            const origin: L2TxHash = rawEvent.transaction_hash as any;
            const parsedEvent = parseEvents(rawEvent);
            // console.log('parsedEvent', parsedEvent);
            // console.log('rawEvent', rawEvent);
            if (
              parsedEvent.hasOwnProperty(
                'pontis::bridge::Bridge::WithdrawEvent'
              )
            ) {
              const { id, amount, recipient } =
                parsedEvent['pontis::bridge::Bridge::WithdrawEvent'];

              subscriber.next({
                type: 'withdrawal',
                id: BigInt(id.toString()),
                amount: BigInt(amount.toString()),
                recipient: wordSpanToHex(recipient as any),
                origin,
                blockNumber,
              });
            }
            if (
              parsedEvent.hasOwnProperty(
                'pontis::bridge::Bridge::CloseBatchEvent'
              )
            ) {
              const root =
                '0x' +
                fromDigest(rawEvent.data.slice(1).map(BigInt)).toString(16);
              subscriber.next({
                type: 'closeBatch',
                id: BigInt(rawEvent.data[0]),
                root,
                origin,
                blockNumber,
              });
            }
          }
          continuationToken = response.continuation_token;
        } while (continuationToken);
        subscriber.complete();
      } catch (err) {
        subscriber.error(err);
      }
    }

    getEvents();
    return () => {};
  });
}

export function contractEvents(
  provider: Provider,
  contractAddress: string,
  initialBlockNumber: number
): Observable<L2Event> {
  return currentBlockRange(provider, initialBlockNumber).pipe(
    switchMap(([previous, current]) =>
      previous <= current
        ? from(
            contractEventsInRange(provider, contractAddress, previous, current)
          )
        : EMPTY
    )
  );
}

export function l2Events(
  provider: Provider,
  initialBlockNumber: number,
  contractAddresses: string[]
): Observable<L2Event> {
  return from(contractAddresses).pipe(
    mergeMap((contractAddress) =>
      contractEvents(provider, contractAddress, initialBlockNumber)
    )
  );
}

export function l2BlockNumber(
  provider: Provider
): Observable<BlockNumberEvent> {
  return currentBlock(provider).pipe(
    map((blockNumber) => ({ type: 'l2BlockNumber', blockNumber }))
  );
}
