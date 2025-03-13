import { L2Event } from './l2/events';
import assert from 'assert';
import { cloneDeep, max } from 'lodash';
import {
  BridgeState,
  DepositAggregatorState,
  getExpansionTree,
  getNthLevelNodes,
  withdrawalExpandedStateFromNode,
  WithdrawalExpanderState,
  WithdrawalExpansionNode,
} from 'l1';
import { l2AddressToHex } from './l1/utils/contractUtil';
import { Sha256 } from 'scrypt-ts';
import logger from './logger';

export type L1Address = string;
export type L2Address = `0x${string}`;

export type L1TxHash = string;
export type L2TxHash = `0x${string}`;

export type L1TxId = {
  type: 'l1tx';
  hash: L1TxHash;
};

export type L1TxStatus = L1TxId &
  (
    | {
        status: 'UNCONFIRMED' | 'DROPPED';
      }
    | {
        status: 'MINED';
        blockNumber: number;
      }
  );

export type L1Tx = L1TxStatus;

export type L2TxId = {
  type: 'l2tx';
  hash: L1TxHash;
};

export type L2TxStatus = L2TxId &
  (
    | { status: 'PENDING' }
    | {
        status: 'SUCCEEDED' | 'REJECTED' | 'REVERTED' | 'ERROR';
        // receipt: ReceiptTx;
      }
  );

export type L2Tx = L2TxStatus;

export type Deposit = {
  amount: bigint;
  recipient: L2Address;
  origin: L1Tx;
};

type DepositBatchCommon = {
  id: bigint;
  deposits: Deposit[];
};

export type DepositAggregationState = DepositAggregatorState & {
  tx: L1Tx;
};

export type DepositBatch =
  | ({
      status: 'BEING_AGGREGATED';
      aggregationTxs: DepositAggregationState[][];
    } & DepositBatchCommon)
  | ({
      status: 'AGGREGATED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      hash: string;
    } & DepositBatchCommon)
  | ({
      status: 'FINALIZED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      hash: string;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_TO_L2';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      hash: string;
      depositTx: L2TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'DEPOSITED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      hash: string;
      depositTx: L2TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_VERIFICATION';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      hash: string;
      depositTx: L2Tx;
      verifyTx: L1Tx;
    } & DepositBatchCommon)
  | ({
      status: 'COMPLETED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      hash: string;
      depositTx: L2Tx;
      verifyTx: L1Tx;
    } & DepositBatchCommon);

export type Withdrawal = {
  amount: bigint;
  recipient: L1Address;
  origin: L2TxHash;
  blockNumber: number;
};

export type WithdrawalExpansionState = WithdrawalExpanderState & {
  tx: L1Tx;
};

type WithdrawalBatchCommon = {
  id: bigint;
  withdrawals: Withdrawal[];
};

export type WithdrawalBatch =
  | ({
      status: 'PENDING';
    } & WithdrawalBatchCommon)
  | ({
      status: 'CLOSE_SUBMITTED';
      closeWithdrawalBatchTx: L2Tx;
    } & WithdrawalBatchCommon)
  | ({
      status: 'CLOSED';
      hash: string;
      closeWithdrawalBatchTx?: L2Tx;
    } & WithdrawalBatchCommon)
  | ({
      status: 'EXPANDER_SUBMITED';
      hash: string;
      closeWithdrawalBatchTx?: L2Tx;
      createExpanderTx: L1Tx;
      expansionTree: WithdrawalExpansionNode;
    } & WithdrawalBatchCommon)
  | ({
      status: 'BEING_EXPANDED';
      hash: string;
      closeWithdrawalBatchTx?: L2Tx;
      createExpanderTx: L1Tx;
      expansionTree: WithdrawalExpansionNode;
      expansionTxs: L1Tx[][];
    } & WithdrawalBatchCommon)
  | ({
      status: 'EXPANDED';
      hash: string;
      closeWithdrawalBatchTx?: L2Tx;
      createExpanderTx: L1Tx;
      expansionTree: WithdrawalExpansionNode;
      expansionTxs: L1Tx[][];
    } & WithdrawalBatchCommon);

export type BridgeCovenantState = BridgeState & {
  latestTx: L1Tx;
};

export type OperatorState = {
  l1BlockNumber: number;
  l2BlockNumber: number;
  l1BridgeBalance: bigint;
  l2TotalSupply: bigint;
  lastDepositBatchId: bigint;
  bridgeState: BridgeCovenantState;
  pendingDeposits: Deposit[];
  depositBatches: DepositBatch[];
  withdrawalBatches: WithdrawalBatch[];
};

export type Deposits = {
  type: 'deposits';
  deposits: Deposit[];
};

export type BlockNumberEvent =
  | { type: 'l1BlockNumber'; blockNumber: number }
  | { type: 'l2BlockNumber'; blockNumber: number };

export type L2TotalSupplyEvent = { type: 'l2TotalSupply'; totalSupply: bigint };
export type L1BridgeBalance = { type: 'l1BridgeBalance'; balance: bigint };

export type BridgeEvent =
  | L2Event
  | Deposits
  | BlockNumberEvent
  | L2TotalSupplyEvent
  | L1BridgeBalance;

export type TransactionId = L1TxId | L2TxId;

export type TransactionStatus = L1TxStatus | L2TxStatus;

export type Transaction = L1Tx | L2Tx;

export type OperatorChange = BridgeEvent | TransactionStatus | BlockNumberEvent;

export type BatchId = string;

export type BridgeEnvironment = {
  MAX_DEPOSIT_BLOCK_AGE: number;
  DEPOSIT_BATCH_SIZE: number;
  MAX_WITHDRAWAL_BLOCK_AGE: number;
  MAX_WITHDRAWAL_BATCH_SIZE: number;
  aggregateDeposits: (
    level: DepositAggregationState[]
  ) => Promise<DepositAggregationState[]>;
  finalizeDepositBatch: (
    bridge: BridgeCovenantState,
    level2: DepositAggregationState
  ) => Promise<[BridgeCovenantState, BatchId]>;
  submitDepositsToL2: (hash: L1TxHash, deposits: Deposit[]) => Promise<L2Tx>;
  verifyDepositBatch: (
    bridgeState: BridgeCovenantState,
    batchId: string
  ) => Promise<BridgeCovenantState>;
  closePendingWithdrawalBatch: (id: bigint) => Promise<L2Tx>;
  createWithdrawalExpander: (
    bridgeState: BridgeCovenantState,
    hash: Sha256,
    expectedWithdrawalState: WithdrawalExpanderState
  ) => Promise<BridgeCovenantState>;
  expandWithdrawals: (
    level: WithdrawalExpansionNode[],
    expansionTxs: L1Tx[]
  ) => Promise<L1Tx[]>;
  distributeWithdrawals: (
    level: WithdrawalExpansionNode[],
    expansionTxs: L1Tx[]
  ) => Promise<L1Tx[]>;
};

let i = 0;

export async function applyChange(
  env: BridgeEnvironment,
  state: OperatorState,
  change: OperatorChange
): Promise<OperatorState> {
  let li = i++;

  if (change.type === 'deposits' || change.type === 'withdrawal') {
    logger.info(change, 'change');
  } else {
    logger.debug(change, 'change');
  }

  const newState = cloneDeep(state);

  switch (change.type) {
    case 'deposits': {
      newState.pendingDeposits.push(...change.deposits);
      break;
    }
    case 'l1tx': {
      updateL1TxStatus(newState, change);
      break;
    }
    case 'l1BlockNumber': {
      newState.l1BlockNumber = change.blockNumber;
      break;
    }
    case 'l2BlockNumber': {
      newState.l2BlockNumber = change.blockNumber;
      break;
    }
    case 'withdrawal': {
      await handleWithdrawal(newState, change);
      break;
    }
    case 'closeBatch': {
      await closeWithdrawalBatch(newState, change);
      break;
    }
    case 'l2tx': {
      updateL2TxStatus(newState, change);
      break;
    }
    case 'l1BridgeBalance':
      newState.l1BridgeBalance = change.balance;
      break;
    case 'l2TotalSupply':
      newState.l2TotalSupply = change.totalSupply;
      break;
    default: {
      const _exhaustiveCheck: never = change;
      return _exhaustiveCheck;
    }
  }

  await initiateAggregation(env, newState);
  await manageAggregation(env, newState);
  await manageVerification(env, newState);
  await sendCloseWithdrawalBatch(env, newState);
  await initiateExpansion(env, newState);
  await manageExpansion(env, newState);
  await initiateExpansion(env, newState);
  updateDeposits(newState);
  await manageVerification(env, newState);
  await sendCloseWithdrawalBatch(env, newState);

  return newState;
}

function updateL1TxStatus(state: OperatorState, status: L1TxStatus) {
  function update(tx: L1Tx) {
    if (tx.hash === status.hash) {
      Object.assign(tx, status);
    }
  }

  update(state.bridgeState.latestTx);

  for (const deposit of state.pendingDeposits) {
    update(deposit.origin);
  }

  for (const batch of state.depositBatches) {
    for (const aggArray of batch.aggregationTxs) {
      for (let i = 0; i < aggArray.length; i++) {
        update(aggArray[i].tx);
      }
    }

    if (
      batch.status === 'FINALIZED' ||
      batch.status === 'SUBMITTED_TO_L2' ||
      batch.status === 'DEPOSITED' ||
      batch.status === 'SUBMITTED_FOR_VERIFICATION' ||
      batch.status === 'COMPLETED' ||
      batch.status === 'AGGREGATED'
    ) {
      update(batch.finalizeBatchTx);
    }

    if (
      batch.status === 'SUBMITTED_FOR_VERIFICATION' ||
      batch.status === 'COMPLETED'
    ) {
      update(batch.verifyTx);
    }
  }

  for (const wb of state.withdrawalBatches) {
    if (wb.status === 'BEING_EXPANDED' || wb.status === 'EXPANDED') {
      for (const expansionArray of wb.expansionTxs) {
        for (let i = 0; i < expansionArray.length; i++) {
          update(expansionArray[i]);
        }
      }
    }
    if (wb.status === 'EXPANDER_SUBMITED') {
      update(wb.createExpanderTx);
    }
  }

  return state;
}

export function getAllL1Txs(state: OperatorState): Set<L1TxId> {
  const l1Txs: L1TxStatus[] = [];

  l1Txs.push(state.bridgeState.latestTx);

  for (const deposit of state.pendingDeposits) {
    l1Txs.push(deposit.origin);
  }

  for (const batch of state.depositBatches) {
    for (const deposit of batch.deposits) {
      l1Txs.push(deposit.origin);
    }

    for (const txArray of batch.aggregationTxs) {
      l1Txs.push(...txArray.map(({ tx }) => tx));
    }

    if (
      batch.status === 'FINALIZED' ||
      batch.status === 'SUBMITTED_TO_L2' ||
      batch.status === 'DEPOSITED' ||
      batch.status === 'SUBMITTED_FOR_VERIFICATION' ||
      batch.status === 'COMPLETED' ||
      batch.status === 'AGGREGATED'
    ) {
      l1Txs.push(batch.finalizeBatchTx);
    }

    if (
      batch.status === 'SUBMITTED_FOR_VERIFICATION' ||
      batch.status === 'COMPLETED'
    ) {
      l1Txs.push(batch.verifyTx);
    }
  }

  for (const wb of state.withdrawalBatches) {
    if (wb.status === 'BEING_EXPANDED' || wb.status === 'EXPANDED') {
      for (const expansionArr of wb.expansionTxs) {
        l1Txs.push(...expansionArr);
      }
    }
    if (wb.status === 'EXPANDER_SUBMITED') {
      l1Txs.push(wb.createExpanderTx);
    }
  }

  return new Set(
    [
      ...new Set(
        l1Txs.filter((tx) => tx.status !== 'MINED').map(({ hash }) => hash)
      ),
    ].map((hash) => ({
      type: 'l1tx',
      hash,
    }))
  );
}

function updateL2TxStatus(state: OperatorState, status: L2TxStatus) {
  function update(tx: L2Tx) {
    if (tx.hash === status.hash) {
      Object.assign(tx, status);
    }
  }

  for (const batch of state.depositBatches) {
    if (
      batch.status === 'SUBMITTED_TO_L2' ||
      batch.status === 'DEPOSITED' ||
      batch.status === 'SUBMITTED_FOR_VERIFICATION' ||
      batch.status === 'COMPLETED'
    ) {
      update(batch.depositTx);
    }
  }

  for (const wb of state.withdrawalBatches) {
    if (
      wb.status === 'CLOSE_SUBMITTED' ||
      wb.status === 'CLOSED' ||
      wb.status === 'BEING_EXPANDED' ||
      wb.status === 'EXPANDED'
    ) {
      if (wb.closeWithdrawalBatchTx) {
        update(wb.closeWithdrawalBatchTx);
      }
    }
  }

  return state;
}

export function getAllL2Txs(state: OperatorState): Set<L2TxId> {
  const results: L2TxStatus[] = [];

  for (const batch of state.depositBatches) {
    if (
      batch.status === 'SUBMITTED_TO_L2' ||
      batch.status === 'DEPOSITED' ||
      batch.status === 'SUBMITTED_FOR_VERIFICATION' ||
      batch.status === 'COMPLETED'
    ) {
      results.push(batch.depositTx);
    }
  }

  for (const wb of state.withdrawalBatches) {
    if (
      wb.status === 'CLOSE_SUBMITTED' ||
      wb.status === 'CLOSED' ||
      wb.status === 'BEING_EXPANDED' ||
      wb.status === 'EXPANDED'
    ) {
      if (wb.closeWithdrawalBatchTx) {
        results.push(wb.closeWithdrawalBatchTx);
      }
    }
  }

  return new Set(
    results
      .filter((tx) => tx.status === 'PENDING')
      .map(({ type, hash }) => ({
        type,
        hash,
      }))
  );
}

async function initiateAggregation(
  env: BridgeEnvironment,
  state: OperatorState
) {
  while (
    state.pendingDeposits.length >= env.DEPOSIT_BATCH_SIZE ||
    depositsOldEnough(env, state)
  ) {
    const batchSize = Math.min(
      2 ** Math.floor(Math.log2(state.pendingDeposits.length)),
      env.DEPOSIT_BATCH_SIZE
    );

    const deposits = state.pendingDeposits.splice(0, batchSize);

    const level0: DepositAggregationState[] = deposits.map(
      ({ origin, amount, recipient }) => ({
        type: 'LEAF',
        level: 0n,
        tx: origin,
        depositAmt: amount,
        depositAddress: l2AddressToHex(recipient),
      })
    );

    if (batchSize === 1) {
      if (state.bridgeState.latestTx.status === 'MINED') {
        state.lastDepositBatchId += 1n;
        const id = state.lastDepositBatchId;
        logger.info({ deposits, id }, 'finalizing');
        // if there is only one deposit, we can finalize the batch directly
        const [bridgeState, batchId] = await env.finalizeDepositBatch(
          state.bridgeState,
          level0[0]
        );
        state.bridgeState = bridgeState;

        state.depositBatches.push({
          id,
          status: 'AGGREGATED',
          deposits,
          aggregationTxs: [level0],
          finalizeBatchTx: state.bridgeState.latestTx,
          hash: batchId,
        });
      }
    } else {
      state.lastDepositBatchId += 1n;
      const id = state.lastDepositBatchId;
      logger.info({ deposits, id }, 'initiating aggregation');
      const aggregationTxs: DepositAggregationState[][] = [
        level0,
        await env.aggregateDeposits(level0),
      ];
      state.depositBatches.push({
        id,
        status: 'BEING_AGGREGATED',
        deposits,
        aggregationTxs,
      });
    }
  }
}

function depositsOldEnough(
  env: BridgeEnvironment,
  state: OperatorState
): boolean {
  for (const deposit of state.pendingDeposits) {
    if (
      deposit.origin.status === 'MINED' &&
      deposit.origin.blockNumber + env.MAX_DEPOSIT_BLOCK_AGE <=
        state.l1BlockNumber
    ) {
      return true;
    }
  }
  return false;
}

async function manageAggregation(env: BridgeEnvironment, state: OperatorState) {
  for (let i = 0; i < state.depositBatches.length; i++) {
    const batch = state.depositBatches[i];
    if (batch.status === 'BEING_AGGREGATED') {
      const aggregationTxs = batch.aggregationTxs.at(-1)!;
      if (aggregationTxs.every((tx) => tx.tx.status === 'MINED')) {
        if (aggregationTxs.length === 1) {
          if (state.bridgeState.latestTx.status === 'MINED') {
            logger.info({ id: batch.id, deposits: 1 }, 'finalizing');
            const [bridgeState, batchId] = await env.finalizeDepositBatch(
              state.bridgeState,
              aggregationTxs.at(0)!
            );
            state.bridgeState = bridgeState;
            state.depositBatches[i] = {
              ...batch,
              status: 'AGGREGATED',
              finalizeBatchTx: state.bridgeState.latestTx,
              hash: batchId,
            };
          }
        } else {
          logger.info(
            { id: batch.id, aggregationLevel: batch.aggregationTxs.length },
            'continuing aggregation'
          );
          const newAggregationLevel = await env.aggregateDeposits(
            batch.aggregationTxs.at(-1)!
          );
          batch.aggregationTxs.push(newAggregationLevel);
        }
      }
    }
    if (
      batch.status === 'AGGREGATED' &&
      batch.finalizeBatchTx.status === 'MINED'
    ) {
      logger.info({ id: batch.id }, 'submitting to L2');
      state.depositBatches[i] = {
        ...batch,
        status: 'SUBMITTED_TO_L2',
        depositTx: await env.submitDepositsToL2(
          batch.aggregationTxs.at(-1)![0]!.tx.hash,
          batch.deposits
        ),
      };
    }
  }
}

function updateDeposits(state: OperatorState) {
  for (let i = 0; i < state.depositBatches.length; i++) {
    const batch = state.depositBatches[i];
    if (
      batch.status === 'SUBMITTED_TO_L2' &&
      batch.depositTx.status === 'SUCCEEDED'
    ) {
      logger.info({ id: batch.id }, 'submitted to L2');
      state.depositBatches[i] = {
        ...batch,
        status: 'DEPOSITED',
      };
    }
  }
}

async function manageVerification(
  env: BridgeEnvironment,
  state: OperatorState
) {
  for (let i = 0; i < state.depositBatches.length; i++) {
    const batch = state.depositBatches[i];

    if (
      batch.status === 'DEPOSITED' &&
      batch.depositTx.status === 'SUCCEEDED' &&
      state.bridgeState.latestTx.status === 'MINED'
    ) {
      logger.info({ id: batch.id }, 'verifing');
      state.bridgeState = await env.verifyDepositBatch(
        state.bridgeState,
        batch.hash
      );
      state.depositBatches[i] = {
        ...batch,
        status: 'SUBMITTED_FOR_VERIFICATION',
        verifyTx: state.bridgeState.latestTx,
      };
    }

    if (
      batch.status === 'SUBMITTED_FOR_VERIFICATION' &&
      batch.verifyTx.status === 'MINED'
    ) {
      logger.info({ id: batch.id }, 'verified');
      state.depositBatches[i] = {
        ...batch,
        status: 'COMPLETED',
      };
    }
  }
}

async function handleWithdrawal(state: OperatorState, change: L2Event) {
  if (change.type === 'withdrawal') {
    let batch = state.withdrawalBatches.find((b) => b.id === change.id);
    if (!batch) {
      assert(
        state.withdrawalBatches.find((b) => b.status === 'PENDING') ===
          undefined,
        'No more than 1 pending batch'
      );
      batch = {
        status: 'PENDING',
        id: change.id,
        withdrawals: [],
      };
      state.withdrawalBatches.push(batch);
    }
    batch.withdrawals.push({
      amount: change.amount,
      recipient: change.recipient,
      origin: change.origin,
      blockNumber: change.blockNumber,
    });
  }
}

async function sendCloseWithdrawalBatch(
  env: BridgeEnvironment,
  state: OperatorState
) {
  for (let i = 0; i < state.withdrawalBatches.length; i++) {
    const batch = state.withdrawalBatches[i];
    if (
      batch.status === 'PENDING' &&
      (batch.withdrawals.length === env.MAX_WITHDRAWAL_BATCH_SIZE ||
        withdrawalsOldEnough(env, state.l2BlockNumber, batch.withdrawals))
    ) {
      logger.info({ id: batch.id }, 'closing');
      state.withdrawalBatches[i] = {
        ...batch,
        status: 'CLOSE_SUBMITTED',
        closeWithdrawalBatchTx: await env.closePendingWithdrawalBatch(batch.id),
      };
    }
  }
}

async function closeWithdrawalBatch(state: OperatorState, change: L2Event) {
  if (change.type === 'closeBatch') {
    for (let i = 0; i < state.withdrawalBatches.length; i++) {
      const batch = state.withdrawalBatches[i];
      if (batch.id === change.id) {
        assert(
          batch.status === 'CLOSE_SUBMITTED' || batch.status === 'PENDING'
        );
        logger.info({ id: batch.id }, 'closed');
        state.withdrawalBatches[i] = {
          ...batch,
          status: 'CLOSED',
          hash: change.root,
        };
      }
    }
  }
}

async function initiateExpansion(env: BridgeEnvironment, state: OperatorState) {
  if (state.bridgeState.latestTx.status !== 'MINED') {
    return;
  }
  for (let i = 0; i < state.withdrawalBatches.length; i++) {
    const batch = state.withdrawalBatches[i];
    if (batch.status === 'CLOSED') {
      logger.info({ id: batch.id }, 'expanding');

      const expansionTree = getExpansionTree(
        batch.withdrawals.map((w) => ({
          l1Address: w.recipient,
          amt: w.amount,
        }))
      );

      const root = Sha256(batch.hash.substring(2));

      assert(expansionTree.hash === root);

      const expectedWithdrawalState =
        withdrawalExpandedStateFromNode(expansionTree);

      const bridgeState = await env.createWithdrawalExpander(
        state.bridgeState,
        root,
        expectedWithdrawalState
      );

      state.bridgeState = bridgeState;

      state.withdrawalBatches[i] = {
        ...batch,
        status: 'EXPANDER_SUBMITED',
        createExpanderTx: bridgeState.latestTx,
        expansionTree,
        hash: root,
      };
    }
  }
}

function withdrawalsOldEnough(
  env: BridgeEnvironment,
  blockNumber: number,
  withdrawals: Withdrawal[]
): boolean {
  for (const withdrawal of withdrawals) {
    if (withdrawal.blockNumber + env.MAX_WITHDRAWAL_BLOCK_AGE <= blockNumber) {
      return true;
    }
  }
  return false;
}

async function distributeOrExpand(
  env: BridgeEnvironment,
  id: bigint,
  level: number,
  expansionLevel: WithdrawalExpansionNode[],
  expansionTxsLevel: L1Tx[]
): Promise<L1Tx[]> {
  if (expansionLevel.every((n) => n.type !== 'INNER')) {
    logger.info({ id, expansionLevel: level }, 'distributing');
    return await env.distributeWithdrawals(expansionLevel, expansionTxsLevel);
  } else {
    assert(expansionLevel.every((n) => n.type === 'INNER'));
    logger.info({ id, expansionLevel: level }, 'expanding');
    return await env.expandWithdrawals(expansionLevel, expansionTxsLevel);
  }
}

async function manageExpansion(env: BridgeEnvironment, state: OperatorState) {
  for (let i = 0; i < state.withdrawalBatches.length; i++) {
    const batch = state.withdrawalBatches[i];

    if (
      batch.status === 'EXPANDER_SUBMITED' &&
      batch.createExpanderTx.status === 'MINED'
    ) {
      const level0Txs = await distributeOrExpand(
        env,
        batch.id,
        0,
        [batch.expansionTree],
        [batch.createExpanderTx]
      );
      state.withdrawalBatches[i] = {
        ...batch,
        status: 'BEING_EXPANDED',
        expansionTxs: [level0Txs],
      };
    } else if (batch.status === 'BEING_EXPANDED') {
      const expansionTxs = batch.expansionTxs.at(-1)!;
      if (expansionTxs.every((tx) => tx.status === 'MINED')) {
        if (expansionTxs.length === batch.withdrawals.length) {
          state.withdrawalBatches[i] = {
            ...batch,
            status: 'EXPANDED',
          };
        } else {
          batch.expansionTxs.push(
            await distributeOrExpand(
              env,
              batch.id,
              batch.expansionTxs.length,
              getNthLevelNodes(batch.expansionTree, batch.expansionTxs.length),
              expansionTxs
            )
          );
        }
      }
    }
  }
}
