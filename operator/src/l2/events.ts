import { Provider, events, CallData, ParsedEvent, Contract } from 'starknet';
import { Observable, from, timer } from 'rxjs';
import {
  switchMap,
  scan,
  distinctUntilChanged,
  mergeMap,
  map,
  filter,
  retry,
  shareReplay,
} from 'rxjs/operators';
import { EMITTED_EVENT } from 'starknet-types-07/dist/types/api/components';
import { L2TotalSupplyEvent, L2Tx, L2Event } from '../state';
import { fromDigest, getTotalSupply, wordSpanToHex } from './contracts';
import logger from '../logger';

const POLL_INTERVAL = 5000;
const CHUNK_SIZE = 10;

export function currentBlock(provider: Provider): Observable<number> {
  return timer(0, POLL_INTERVAL).pipe(
    switchMap(async () => (await provider.getBlock('latest')).block_number),
    retry({
      delay: (error, retryCount) => {
        logger.warn(
          { retryCount, message: error.message },
          'current l2 block retry attempt'
        );
        return timer(POLL_INTERVAL);
      },
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );
}

export function currentBlockRange(
  provider: Provider,
  initialBlockNumber: number
): Observable<[number, number]> {
  return currentBlock(provider).pipe(
    scan(
      ([_, previous], current) => [previous + 1, current] as [number, number],
      [0, initialBlockNumber] as [number, number]
    ),
    filter(([previous, current]) => previous <= current)
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

function contractEventsInRange(
  provider: Provider,
  contractAddress: string,
  from: number,
  to: number
) {
  logger.debug({ contractAddress, from, to }, 'looking for L2 events');
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
            const origin: L2Tx = {
              type: 'l2tx',
              hash: rawEvent.transaction_hash as any,
              blockNumber: rawEvent.block_number,
              status: 'SUCCEEDED',
            };

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
              });
            }
            if (
              parsedEvent.hasOwnProperty(
                'pontis::bridge::Bridge::CloseBatchEvent'
              )
            ) {
              const root =
                '0x' +
                fromDigest(rawEvent.data.slice(1).map(BigInt))
                  .toString(16)
                  .padStart(64, '0');
              subscriber.next({
                type: 'closeBatch',
                id: BigInt(rawEvent.data[0]),
                root,
                origin,
              });
            }
            if (
              parsedEvent.hasOwnProperty('pontis::bridge::Bridge::DepositEvent')
            ) {
              const id = fromDigest(rawEvent.data.slice(0, 8).map(BigInt))
                .toString(16)
                .padStart(64, '0');
              const total = BigInt(rawEvent.data[8]);

              subscriber.next({
                type: 'batchDeposited',
                id,
                origin,
              });
            }
          }
          continuationToken = response.continuation_token;
        } while (continuationToken);
        subscriber.next({ type: 'l2BlockNumber', blockNumber: to });
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
      from(contractEventsInRange(provider, contractAddress, previous, current))
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

export function totalSupply(
  provider: Provider,
  btc: Contract
): Observable<L2TotalSupplyEvent> {
  return currentBlock(provider).pipe(
    switchMap(() => getTotalSupply(btc)),
    distinctUntilChanged(),
    map((totalSupply) => ({ type: 'l2TotalSupply', totalSupply }))
  );
}
