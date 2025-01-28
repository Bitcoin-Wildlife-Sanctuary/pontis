import { Provider, events, CallData, ParsedEvent } from 'starknet';
import { Observable, interval, from } from 'rxjs';
import { switchMap, scan, distinctUntilChanged } from 'rxjs/operators';
import { EVENT } from 'starknet-types-07/dist/types/api/components';

const POLL_INTERVAL = 5000;
const CHUNK_SIZE = 10;

export function currentBlockRange(
  provider: Provider,
  initialBlockNumber: number
): Observable<[number, number]> {
  const blocks$: Observable<number> = interval(POLL_INTERVAL).pipe(
    switchMap(async () => (await provider.getBlock('latest')).block_number),
    distinctUntilChanged()
  );

  return blocks$.pipe(
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
): Promise<(rawEvent: EVENT) => ParsedEvent> {
  const { abi } = await provider.getClassAt(contractAddress);
  if (abi === undefined) {
    throw 'no abi';
  }

  const abiEvents = events.getAbiEvents(abi);
  const abiStructs = CallData.getAbiStruct(abi);
  const abiEnums = CallData.getAbiEnum(abi);

  return (rawEvent: EVENT) =>
    events.parseEvents([rawEvent], abiEvents, abiStructs, abiEnums)[0];
}

export type L2Event = { blockNumber: number; parsedEvent: ParsedEvent };

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
            // you can include `keys: [<event key(s)>]` here.
            chunk_size: CHUNK_SIZE,
            // continuation_token: continuationToken,
          });

          const events = response.events;
          for (const rawEvent of events) {
            const blockNumber = rawEvent.block_number;
            const parsedEvent = parseEvents(rawEvent);
            subscriber.next({ blockNumber, parsedEvent });
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
    switchMap((contractAddress) =>
      contractEvents(provider, contractAddress, initialBlockNumber)
    )
  );
}
