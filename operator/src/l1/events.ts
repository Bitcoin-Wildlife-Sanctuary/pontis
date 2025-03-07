import {
  distinctUntilChanged,
  from,
  map,
  Observable,
  switchMap,
  scan,
  timer,
  filter,
  retry,
  distinctUntilKeyChanged,
  takeWhile,
} from 'rxjs';
import {
  BlockNumberEvent,
  BridgeEvent,
  Deposit,
  Deposits,
  L1TxId,
  L1TxStatus,
  OperatorState,
} from '../state';
import * as l1Api from './api';
import { createL1Provider, L1Provider } from './deps/l1Provider';
import logger from '../logger';
import { Config } from '../config';
import { getL1TransactionStatus } from './api';

const POLL_INTERVAL = 5000;

export function l1BlockNumber(
  provider: L1Provider
): Observable<BlockNumberEvent> {
  return currentBlock(provider).pipe(
    map((blockNumber) => ({ type: 'l1BlockNumber', blockNumber }))
  );
}

function currentBlock(provider: L1Provider): Observable<number> {
  return timer(0, POLL_INTERVAL).pipe(
    switchMap(() => from(l1Api.getL1CurrentBlockNumber(provider))),
    retry({
      delay: (error, retryCount) => {
        console.warn(
          `CurrentBlock retry attempt #${retryCount}, due to: ${error.message}`
        );
        return timer(POLL_INTERVAL);
      },
    }),
    distinctUntilChanged()
  );
}

export function currentBlockRange(
  provider: L1Provider,
  initialBlockNumber: number
): Observable<[number, number]> {
  return currentBlock(provider).pipe(
    scan(
      ([_, previous], current) => [previous + 1, current],
      [0, initialBlockNumber]
    )
  );
}

export function deposits(
  config: Config,
  initialBlockNumber: number
): Observable<Deposits> {
  return currentBlockRange(
    config.l1.createL1Provider(),
    initialBlockNumber
  ).pipe(
    switchMap(([previous, current]) =>
      from(depositsInRange(config, previous, current))
    ),
    filter((deposits) => deposits.length > 0),
    map((deposits) => ({ type: 'deposits', deposits }))
  );
}

async function depositsInRange(
  config: Config,
  blockFrom: number,
  blockTo: number
): Promise<Deposit[]> {
  logger.debug({ blockFrom, blockTo }, 'looking for deposits');
  const deposits = await l1Api.listDeposits(
    blockFrom,
    blockTo,
    config.l1.operatorSigner,
    config.l1.network,
    config.l1.createL1Provider(),
    config.l1.createChainProvider()
  );

  return deposits;
}

export function l1BridgeBalance(
  config: Config,
  state: Observable<OperatorState>
): Observable<BridgeEvent> {
  return state.pipe(
    filter((s) => s.bridgeState.latestTx.status === 'MINED'),
    map((s) => s.bridgeState.latestTx.hash),
    distinctUntilChanged(),
    switchMap((txId) =>
      l1Api.getBridgeBalance(
        config.l1.operatorSigner,
        txId,
        config.l1.createUtxoProvider(),
        config.l1.network
      )
    ),
    map((balance) => ({ type: 'l1BridgeBalance', balance }))
  );
}

export function l1TransactionStatus(
  l1Provider: L1Provider,
  tx: L1TxId
): Observable<L1TxStatus> {
  return timer(0, 5000).pipe(
    switchMap(() => from(getL1TransactionStatus(l1Provider, tx.hash))),
    distinctUntilKeyChanged('status'),
    takeWhile((tx) => tx.status !== 'MINED', true)
  );
}
