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
} from 'rxjs';
import {
  BlockNumberEvent,
  BridgeEvent,
  Deposit,
  Deposits,
  OperatorState,
} from '../state';
import * as l1Api from './api';
import * as env from './env';
import { createL1Provider } from './deps/l1Provider';

const POLL_INTERVAL = 5000;

export function l1BlockNumber(): Observable<BlockNumberEvent> {
  return currentBlock().pipe(
    map((blockNumber) => ({ type: 'l1BlockNumber', blockNumber }))
  );
}

function currentBlock(): Observable<number> {
  return timer(0, POLL_INTERVAL).pipe(
    switchMap(() => from(getCurrentL1BlockNumber())),
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
    switchMap(([previous, current]) =>
      from(depositsInRange(previous, current))
    ),
    filter((deposits) => deposits.length > 0),
    map((deposits) => ({ type: 'deposits', deposits }))
  );
}

async function getCurrentL1BlockNumber(): Promise<number> {
  return l1Api.getL1CurrentBlockNumber(
    createL1Provider(env.useRpc, env.rpcConfig, env.l1Network)
  );
}

async function depositsInRange(
  blockFrom: number,
  blockTo: number
): Promise<Deposit[]> {
  console.log('looking for deposits:', JSON.stringify({ blockFrom, blockTo }));
  const deposits = await l1Api.listDeposits(
    blockFrom,
    blockTo,
    env.operatorSigner,
    env.l1Network,
    createL1Provider(env.useRpc, env.rpcConfig, env.l1Network),
    env.createChainProvider()
  );

  return deposits;
}

export function l1BridgeBalance(
  state: Observable<OperatorState>
): Observable<BridgeEvent> {
  return state.pipe(
    filter((s) => s.bridgeState.latestTx.status === 'MINED'),
    map((s) => s.bridgeState.latestTx.hash),
    distinctUntilChanged(),
    switchMap((txId) =>
      l1Api.getBridgeBalance(
        env.operatorSigner,
        txId,
        env.createUtxoProvider(),
        env.l1Network
      )
    ),
    map((balance) => ({ type: 'l1BridgeBalance', balance }))
  );
}
