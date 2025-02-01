import { ReceiptTx } from 'starknet';
import { L2Event } from './l2/events';
import { assert } from 'console';
import { cloneDeep } from 'lodash';

export type L1Address = `0x${string}`;
export type L2Address = `0x${string}`;

export type L1TxHash = `0x${string}`;
export type L2TxHash = `0x${string}`;

// TODO: everything about L1 is very WIP, should be checked with sCrypt team

export type L1TxId = {
  type: 'l1tx';
  hash: L1TxHash;
};

export type L1TxStatus = L1TxId & {
  status: 'Unconfirmed' | 'Confirmed' | 'Mined'; // Orphaned, Droped?;
};

export type L1Tx = L1TxStatus & {
  timestamp: number;
}; // TODO: What else should go into a l1 tx?

export type L2TxId = {
  type: 'l2tx';
  hash: L1TxHash;
};

export type L2TxStatus = L2TxId &
  (
    | { status: 'PENDING' }
    | {
        status: 'SUCCEEDED' | 'REJECTED' | 'REVERTED' | 'ERROR';
        receipt: ReceiptTx;
      }
  );

export type L2Tx = L2TxStatus;

export type Deposit = {
  amount: bigint;
  recipient: L2Address;
  origin: L1Tx;
};

type DepositBatchCommon = {
  deposits: Deposit[];
};

type DepositBatch =
  | ({
      status: 'BEING_AGGREGATED';
      aggregationTxs: L1Tx[][];
    } & DepositBatchCommon)
  | ({
      status: 'AGGREGATED';
      aggregationTxs: L1Tx[][];
      finalizeBatchTx: L1Tx;
    } & DepositBatchCommon)
  | ({
      status: 'FINALIZED';
      aggregationTxs: L1Tx[][];
      finalizeBatchTx: L1Tx;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_TO_L2';
      aggregationTxs: L1Tx[][];
      finalizeBatchTx: L1Tx;
      depositTx: L2TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'DEPOSITED';
      aggregationTxs: L1Tx[][];
      finalizeBatchTx: L1Tx;
      depositTx: L2TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_COMPLETION';
      aggregationTxs: L1Tx[][];
      finalizeBatchTx: L1Tx;
      depositTx: L2TxStatus;
      verifyTx: L1TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'COMPLETED';
      aggregationTxs: L1Tx[][];
      finalizeBatchTx: L1Tx;
      depositTx: L2TxStatus;
      verifyTx: L1TxStatus;
    } & DepositBatchCommon);

type Withdrawal = {
  amount: bigint;
  recipient: L1Address;
  origin: L2TxHash;
};

type WithdrawalBatchCommon = {
  id: bigint;
  withdrawals: Withdrawal[];
};

type WithdrawalBatch =
  | ({
      status: 'PENDING';
      id: bigint;
      withdrawals: Withdrawal[];
    } & WithdrawalBatchCommon)
  | ({
      status: 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2Tx;
    } & WithdrawalBatchCommon)
  | ({
      status: 'CLOSED';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2Tx;
    } & WithdrawalBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_EXPANSION';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2Tx;
      withdrawBatchTx: L1TxStatus;
    } & WithdrawalBatchCommon)
  | ({
      status: 'BEING_EXPANDED';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2Tx;
      withdrawBatchTx: L1TxStatus;
      expansionTxs: L1TxStatus[][];
    } & WithdrawalBatchCommon)
  | ({
      status: 'EXPANDED';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2Tx;
      withdrawBatchTx: L1TxStatus;
      expansionTxs: L1TxStatus[][];
    } & WithdrawalBatchCommon);

export type OperatorState = {
  timestamp: number;
  l1BlockNumber: number;
  l2BlockNumber: number;
  total: bigint;
  pendingDeposits: Deposit[];
  depositBatches: DepositBatch[];
  withdrawalBatches: WithdrawalBatch[];
};

export type Deposits = {
  type: 'deposits';
  deposits: Deposit[];
};

export type TickEvent = { type: 'tick'; timestamp: number };

export type BridgeEvent = L2Event | Deposits | TickEvent;

export type TransactionId = L1TxId | L2TxId;

export type TransactionStatus = L1TxStatus | L2TxStatus;

export type Transaction = L1Tx | L2Tx;

export type OperatorChange = BridgeEvent | TransactionStatus | TickEvent;

export type BridgeEnvironment = {
  DEPOSIT_BATCH_SIZE: number;
  MAX_PENDING_DEPOSITS: number;
  aggregateDeposits: (txs: L1Tx[]) => Promise<L1Tx[]>;
  finalizeBatch: (tx: L1TxStatus) => Promise<L1Tx>;
  submitDepositsToL2: (hash: L1TxHash, deposits: Deposit[]) => Promise<L2Tx>;
};

export async function applyChange(
  env: BridgeEnvironment,
  state: OperatorState,
  change: OperatorChange
): Promise<OperatorState> {
  const newState = cloneDeep(state);

  switch (change.type) {
    case 'deposits': {
      newState.pendingDeposits.push(...change.deposits);
      await initiateAggregation(env, state);
      break;
    }
    case 'l1tx': {
      updateL1TxStatus(newState, change);
      await manageAggregation(env, newState);
      break;
    }
    case 'tick': {
      newState.timestamp = change.timestamp;
      await initiateAggregation(env, newState);
      await manageAggregation(env, newState);
      break;
    }
    case 'l2event': {
      assert(change.blockNumber >= newState.l2BlockNumber);
      newState.l2BlockNumber = change.blockNumber;
      // `event` is of type L2Event here
      console.log('Handling L2Event:', change);
      break;
    }
    case 'l2tx': {
      updateL2TxStatus(newState, change);
      updateDeposits(newState);
      break;
    }
    default: {
      const _exhaustiveCheck: never = change;
      return _exhaustiveCheck;
    }
  }
  return newState;
}

function updateL1TxStatus(state: OperatorState, tx: L1TxStatus) {
  // TODO: make sure it is complete, generated by o1
  for (const deposit of state.pendingDeposits) {
    if (deposit.origin.hash === tx.hash) {
      deposit.origin.status = tx.status;
    }
  }

  for (const batch of state.depositBatches) {
    for (const aggArray of batch.aggregationTxs) {
      for (let i = 0; i < aggArray.length; i++) {
        if (aggArray[i].hash === tx.hash) {
          aggArray[i].status = tx.status;
        }
      }
    }

    if (
      batch.status === 'FINALIZED' ||
      batch.status === 'SUBMITTED_TO_L2' ||
      batch.status === 'DEPOSITED' ||
      batch.status === 'SUBMITTED_FOR_COMPLETION' ||
      batch.status === 'COMPLETED' ||
      batch.status === 'AGGREGATED'
    ) {
      if (batch.finalizeBatchTx.hash === tx.hash) {
        batch.finalizeBatchTx.status = tx.status;
      }
    }

    if (
      batch.status === 'SUBMITTED_FOR_COMPLETION' ||
      batch.status === 'COMPLETED'
    ) {
      if (batch.verifyTx.hash === tx.hash) {
        batch.verifyTx.status = tx.status;
      }
    }
  }

  for (const wb of state.withdrawalBatches) {
    if (
      wb.status === 'SUBMITTED_FOR_EXPANSION' ||
      wb.status === 'BEING_EXPANDED' ||
      wb.status === 'EXPANDED'
    ) {
      if (wb.withdrawBatchTx.hash === tx.hash) {
        wb.withdrawBatchTx.status = tx.status;
      }
    }

    if (wb.status === 'BEING_EXPANDED' || wb.status === 'EXPANDED') {
      for (const expansionArray of wb.expansionTxs) {
        for (let i = 0; i < expansionArray.length; i++) {
          if (expansionArray[i].hash === tx.hash) {
            expansionArray[i].status = tx.status;
          }
        }
      }
    }
  }

  return state;
}

export function getAllL1Txs(state: OperatorState): Set<L1TxId> {
  const l1Txs: L1TxStatus[] = [];

  for (const deposit of state.pendingDeposits) {
    l1Txs.push(deposit.origin);
  }

  for (const batch of state.depositBatches) {
    for (const deposit of batch.deposits) {
      l1Txs.push(deposit.origin);
    }

    for (const txArray of batch.aggregationTxs) {
      l1Txs.push(...txArray);
    }

    if (
      batch.status === 'FINALIZED' ||
      batch.status === 'SUBMITTED_TO_L2' ||
      batch.status === 'DEPOSITED' ||
      batch.status === 'SUBMITTED_FOR_COMPLETION' ||
      batch.status === 'COMPLETED' ||
      batch.status === 'AGGREGATED'
    ) {
      l1Txs.push(batch.finalizeBatchTx);
    }

    if (
      batch.status === 'SUBMITTED_FOR_COMPLETION' ||
      batch.status === 'COMPLETED'
    ) {
      l1Txs.push(batch.verifyTx);
    }
  }

  for (const wb of state.withdrawalBatches) {
    if (
      wb.status === 'SUBMITTED_FOR_EXPANSION' ||
      wb.status === 'BEING_EXPANDED' ||
      wb.status === 'EXPANDED'
    ) {
      l1Txs.push(wb.withdrawBatchTx);
    }

    if (wb.status === 'BEING_EXPANDED' || wb.status === 'EXPANDED') {
      for (const expansionArr of wb.expansionTxs) {
        l1Txs.push(...expansionArr);
      }
    }
  }

  return new Set(
    l1Txs
      .filter((tx) => tx.status !== 'Mined')
      .map(({ type, hash }) => ({
        type,
        hash,
      }))
  );
}

function updateL2TxStatus(state: OperatorState, tx: L2TxStatus) {
  for (const batch of state.depositBatches) {
    if (
      batch.status === 'SUBMITTED_TO_L2' ||
      batch.status === 'DEPOSITED' ||
      batch.status === 'SUBMITTED_FOR_COMPLETION' ||
      batch.status === 'COMPLETED'
    ) {
      if (batch.depositTx.hash === tx.hash) {
        batch.depositTx = { ...batch.depositTx, ...tx };
      }
    }
  }

  for (const wb of state.withdrawalBatches) {
    if (
      wb.status === 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED' ||
      wb.status === 'CLOSED' ||
      wb.status === 'SUBMITTED_FOR_EXPANSION' ||
      wb.status === 'BEING_EXPANDED' ||
      wb.status === 'EXPANDED'
    ) {
      if (wb.closeWithdrawalBatchTx.hash === tx.hash) {
        wb.closeWithdrawalBatchTx = { ...wb.closeWithdrawalBatchTx, ...tx };
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
      batch.status === 'SUBMITTED_FOR_COMPLETION' ||
      batch.status === 'COMPLETED'
    ) {
      results.push(batch.depositTx);
    }
  }

  for (const wb of state.withdrawalBatches) {
    if (
      wb.status === 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED' ||
      wb.status === 'CLOSED' ||
      wb.status === 'SUBMITTED_FOR_EXPANSION' ||
      wb.status === 'BEING_EXPANDED' ||
      wb.status === 'EXPANDED'
    ) {
      results.push(wb.closeWithdrawalBatchTx);
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
    waitedLongEnough(env, state)
  ) {
    const batchSize = Math.min(
      2 ** Math.floor(Math.log2(state.pendingDeposits.length)),
      env.DEPOSIT_BATCH_SIZE
    );
    console.log('aggregating', batchSize, 'deposits');

    const deposits = state.pendingDeposits.splice(0, batchSize);
    state.pendingDeposits = state.pendingDeposits.slice(batchSize);

    if (batchSize === 1) {
      state.depositBatches.push({
        status: 'BEING_AGGREGATED',
        deposits,
        aggregationTxs: [[deposits[0].origin]],
      });
    } else {
      const aggregationTxs: L1Tx[][] = [
        await env.aggregateDeposits(deposits.map((d) => d.origin)),
      ];
      state.depositBatches.push({
        status: 'BEING_AGGREGATED',
        deposits,
        aggregationTxs,
      });
    }
  }
}

function waitedLongEnough(
  env: BridgeEnvironment,
  state: OperatorState
): boolean {
  for (const deposit of state.pendingDeposits) {
    if (deposit.origin.timestamp + env.MAX_PENDING_DEPOSITS < state.timestamp) {
      return true;
    }
  }
  return false;
}

async function manageAggregation(
  env: BridgeEnvironment,
  newState: OperatorState
) {
  for (let i = 0; i < newState.depositBatches.length; i++) {
    const batch = newState.depositBatches[i];
    if (batch.status === 'BEING_AGGREGATED') {
      const aggregationTxs = batch.aggregationTxs.at(-1);
      if (
        aggregationTxs &&
        aggregationTxs.every((tx) => tx.status === 'Mined')
      ) {
        if (aggregationTxs.length === 1) {
          const finalizeBatchTx = await env.finalizeBatch(aggregationTxs[0]);
          newState.depositBatches[i] = {
            ...batch,
            status: 'AGGREGATED',
            finalizeBatchTx,
          };
        } else {
          const newAggregationLevel =
            await env.aggregateDeposits(aggregationTxs);
          batch.aggregationTxs.push(newAggregationLevel);
        }
      }
    }
    if (
      batch.status === 'AGGREGATED' &&
      batch.finalizeBatchTx.status === 'Mined'
    ) {
      console.log('Submitting to l2:', batch.finalizeBatchTx.hash);
      newState.depositBatches[i] = {
        ...batch,
        status: 'SUBMITTED_TO_L2',
        depositTx: await env.submitDepositsToL2(
          batch.finalizeBatchTx.hash,
          batch.deposits
        ),
      };
    }
  }
}
function updateDeposits(newState: OperatorState) {
  for (let i = 0; i < newState.depositBatches.length; i++) {
    const depositBatch = newState.depositBatches[i];
    switch (depositBatch.status) {
      case 'SUBMITTED_TO_L2':
        if (depositBatch.depositTx.status === 'SUCCEEDED') {
          newState.depositBatches[i] = {
            ...depositBatch,
            status: 'DEPOSITED',
          };
        }
        break;
    }
  }
}
