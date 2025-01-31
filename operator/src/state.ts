import { ReceiptTx } from 'starknet';
import { L2Event } from './l2/events';
import { assert } from 'console';
import { cloneDeep } from 'lodash';

type L1Address = `0x${string}`;
type L2Address = `0x${string}`;

type L1TxHash = `0x${string}`;
type L2TxHash = `0x${string}`;

// TODO: everything about L1 is very WIP, should be checked with sCrypt team
export type L1TxStatus = 'Unconfirmed' | 'Confirmed' | 'Mined'; // Orphaned, Droped?
export type L1TxHashAndStatus = {
  type: 'l1tx';
  hash: L1TxHash;
  status: L1TxStatus;
  blockNumber: number;
  timestamp: number;
};
export type L2TxHashAndStatus = {
  type: 'l2tx';
  hash: L2TxHash;
  status: ReceiptTx;
  blockNumber: bigint;
};

export type Deposit = {
  amount: bigint;
  recipient: L2Address;
  origin: L1TxHashAndStatus;
};

type DepositBatchCommon = {
  deposits: Deposit[];
};

type DepositBatch =
  | ({
      status: 'BEING_AGGREGATED';
      aggregationTxs: L1TxHashAndStatus[][];
    } & DepositBatchCommon)
  | ({
      status: 'AGGREGATED';
      aggregationTxs: L1TxHashAndStatus[][];
      finalizeBatchTx: L1TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'FINALIZED';
      aggregationTxs: L1TxHashAndStatus[][];
      finalizeBatchTx: L1TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_TO_L2';
      aggregationTxs: L1TxHashAndStatus[][];
      finalizeBatchTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'DEPOSITED';
      aggregationTxs: L1TxHashAndStatus[][];
      finalizeBatchTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_COMPLETION';
      aggregationTxs: L1TxHashAndStatus[][];
      finalizeBatchTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
      verifyTx: L1TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'COMPLETED';
      aggregationTxs: L1TxHashAndStatus[][];
      finalizeBatchTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
      verifyTx: L1TxHashAndStatus;
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
      closeWithdrawalBatchTx: L2TxHashAndStatus;
    } & WithdrawalBatchCommon)
  | ({
      status: 'CLOSED';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2TxHashAndStatus;
    } & WithdrawalBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_EXPANSION';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2TxHashAndStatus;
      withdrawBatchTx: L1TxHashAndStatus;
    } & WithdrawalBatchCommon)
  | ({
      status: 'BEING_EXPANDED';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2TxHashAndStatus;
      withdrawBatchTx: L1TxHashAndStatus;
      expansionTxs: L1TxHashAndStatus[][];
    } & WithdrawalBatchCommon)
  | ({
      status: 'EXPANDED';
      withdrawals: Withdrawal[];
      hash: bigint;
      closeWithdrawalBatchTx: L2TxHashAndStatus;
      withdrawBatchTx: L1TxHashAndStatus;
      expansionTxs: L1TxHashAndStatus[][];
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

export type Transaction = L1TxHashAndStatus | L2TxHashAndStatus;

export type OperatorChange = BridgeEvent | Transaction | TickEvent;

export type BridgeEnvironment = {
  DEPOSIT_BATCH_SIZE: number;
  MAX_PENDING_DEPOSITS: number;
  aggregateDeposits: (txs: L1TxHashAndStatus[]) => Promise<L1TxHashAndStatus[]>;
  finalizeBatch: (tx: L1TxHashAndStatus) => Promise<L1TxHashAndStatus>;
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
      console.log('Handling L2Tx:', change);
      for (let i = 0; i < newState.depositBatches.length; i++) {
        const depositBatch = newState.depositBatches[i];
        switch (depositBatch.status) {
          case 'SUBMITTED_TO_L2':
            if (depositBatch.depositTx.hash === change.hash) {
              if (change.status.isSuccess()) {
                // TODO: finality?
                newState.depositBatches[i] = {
                  ...depositBatch,
                  depositTx: change,
                  status: 'DEPOSITED',
                };
              } else {
                depositBatch.depositTx = change;
              }
            }
            break;
        }
      }
      break;
    }
    default: {
      const _exhaustiveCheck: never = change;
      return _exhaustiveCheck;
    }
  }
  return newState;
}

function updateL1TxStatus(state: OperatorState, tx: L1TxHashAndStatus) {
  // TODO: make sure it is complete, generated by o1
  // 1. Check pendingDeposits (each Deposit has origin: L1TxHashAndStatus)
  for (const deposit of state.pendingDeposits) {
    if (deposit.origin.hash === tx.hash) {
      deposit.origin.status = tx.status;
    }
  }

  // 2. Check depositBatches
  for (const batch of state.depositBatches) {
    // a) aggregationTxs is always present (array of arrays)
    for (const aggArray of batch.aggregationTxs) {
      for (let i = 0; i < aggArray.length; i++) {
        if (aggArray[i].hash === tx.hash) {
          aggArray[i].status = tx.status;
        }
      }
    }

    // b) Some batch statuses have finalizeBatchTx
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

    // c) Some batch statuses have verifyTx
    if (
      batch.status === 'SUBMITTED_FOR_COMPLETION' ||
      batch.status === 'COMPLETED'
    ) {
      if (batch.verifyTx.hash === tx.hash) {
        batch.verifyTx.status = tx.status;
      }
    }
  }

  // 3. Check withdrawalBatches
  for (const wb of state.withdrawalBatches) {
    // a) Some statuses have withdrawBatchTx
    if (
      wb.status === 'SUBMITTED_FOR_EXPANSION' ||
      wb.status === 'BEING_EXPANDED' ||
      wb.status === 'EXPANDED'
    ) {
      if (wb.withdrawBatchTx.hash === tx.hash) {
        wb.withdrawBatchTx.status = tx.status;
      }
    }

    // b) Some statuses have expansionTxs (array of arrays)
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

export function getAllL1Txs(state: OperatorState): Set<L1TxHashAndStatus> {
  const l1Txs: L1TxHashAndStatus[] = [];

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

  return new Set(l1Txs.filter((tx) => tx.status !== 'Mined'));
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
      const aggregationTxs: L1TxHashAndStatus[][] = [
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
    // if( batch.status == 'AGGREGATED' && batch.finalizeBatchTx.status == 'Mined' ) {
    //   // submit to L2
    //   // newState.depositBatches[i] = {
    //   //   ...batch,
    //   //   status: 'SUBMITTED_TO_L2',
    //   //   depositTx: await submitToL2(batch.finalizeBatchTx)
    //   // }
    // }
  }
}
