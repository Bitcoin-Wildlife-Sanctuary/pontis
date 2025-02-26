import {
  L1Tx,
  L1TxId,
  L1TxStatus,
  WithdrawalBatch,
  DepositAggregationState,
  DepositBatch,
  BridgeCovenantState,
  BatchId,
} from '../state';
import {
  distinctUntilKeyChanged,
  from,
  Observable,
  switchMap,
  takeWhile,
  tap,
  timer,
} from 'rxjs';
import * as l1Api from './api';
import { createL1Provider } from './deps/l1Provider';
import * as env from './env';
import { getFileOffChainDataProvider } from './deps/offchainDataProvider';
import {
  EnhancedProvider,
  ExpansionMerkleTree,
  WithdrawalExpanderState,
} from 'l1';
import { Sha256 } from 'scrypt-ts';

export function l1TransactionStatus(
  // add whatever parameters you need
  tx: L1TxId
): Observable<L1TxStatus> {
  return timer(0, 5000).pipe(
    switchMap(() => from(getL1TransactionStatus(tx))),
    distinctUntilKeyChanged('status'),
    takeWhile((tx) => tx.status !== 'MINED', true)
  );
}

async function getL1TransactionStatus(
  tx: L1TxId
  // add whatever parameters you need
): Promise<L1TxStatus> {
  const l1ChainProvider = createL1Provider(
    env.useRpc,
    env.rpcConfig,
    env.l1Network
  );
  return await l1Api.getL1TransactionStatus(l1ChainProvider, tx.hash);
}

export async function isAggregationCompleted(
  batch: DepositBatch
): Promise<boolean> {
  return !l1Api.shouldAggregate(batch);
}

export async function aggregateDeposits(
  level: DepositAggregationState[]
): Promise<DepositAggregationState[]> {
  return await l1Api.aggregateLevelDeposits(
    env.operatorSigner,
    env.l1Network,
    new EnhancedProvider(
      env.createUtxoProvider(),
      env.createChainProvider(),
      true
    ),
    env.l1FeeRate,
    level
  );
}

export async function finalizeDepositBatch(
  bridgeState: BridgeCovenantState,
  root: DepositAggregationState
): Promise<[BridgeCovenantState, BatchId]> {
  return await l1Api.finalizeDepositBatchOnL1(
    env.operatorSigner,
    env.l1Network,
    env.createUtxoProvider(),
    env.createChainProvider(),
    createL1Provider(env.useRpc, env.rpcConfig, env.l1Network),
    env.l1FeeRate,
    root,
    bridgeState
  );
}

export async function verifyDepositBatch(
  bridgeState: BridgeCovenantState,
  batchId: BatchId
): Promise<BridgeCovenantState> {
  return await l1Api.verifyDepositBatch(
    env.operatorSigner,
    env.l1Network,
    env.createUtxoProvider(),
    env.createChainProvider(),
    createL1Provider(env.useRpc, env.rpcConfig, env.l1Network),
    env.l1FeeRate,
    bridgeState,
    batchId
  );
}

/// create the withdrawal expander, return the L1Tx
export async function createWithdrawalExpander(
  bridgeState: BridgeCovenantState,
  hash: Sha256,
  expectedWithdrawalState: WithdrawalExpanderState
): Promise<BridgeCovenantState> {
  return await l1Api.createWithdrawal2(
    env.operatorSigner,
    env.l1Network,
    env.createUtxoProvider(),
    env.createChainProvider(),
    createL1Provider(env.useRpc, env.rpcConfig, env.l1Network),
    env.l1FeeRate,
    bridgeState,
    hash,
    expectedWithdrawalState
  );
}

/// check if the withdrawal batch is completed, do not need to call expandWithdrawal if it is completed
export function isExpansionCompleted(batch: WithdrawalBatch): boolean {
  return !l1Api.shouldDistribute(batch) && !l1Api.shouldExpand(batch);
}

/// expand the withdrawal batch, return the txids. In the inner implementation, it will call expand or distribute
export async function expandWithdrawals(
  level: number,
  tree: ExpansionMerkleTree,
  expansionTxs: L1Tx[]
): Promise<L1Tx[]> {
  return await l1Api.expandLevelWithdrawals2(
    env.operatorSigner,
    env.l1Network,
    new EnhancedProvider(
      env.createUtxoProvider(),
      env.createChainProvider(),
      true
    ),
    env.l1FeeRate,
    level,
    tree,
    expansionTxs
  );
}

export async function distributeWithdrawals(
  level: number,
  tree: ExpansionMerkleTree,
  expansionTxs: L1Tx[]
): Promise<L1Tx[]> {
  return await l1Api.distributeLevelWithdrawals2(
    env.operatorSigner,
    env.l1Network,
    new EnhancedProvider(
      env.createUtxoProvider(),
      env.createChainProvider(),
      true
    ),
    env.l1FeeRate,
    level,
    tree,
    expansionTxs
  );
}
