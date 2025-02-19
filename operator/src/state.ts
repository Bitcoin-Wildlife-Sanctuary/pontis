import { ReceiptTx } from 'starknet';
import { L2Event } from './l2/events';
import { assert } from 'console';
import { cloneDeep, max } from 'lodash';
import { Sha256 } from 'scrypt-ts';
import { DepositAggregatorState } from 'l1';
import { l2AddressToHex } from './l1/utils/contractUtil';

export type L1Address = `0x${string}`;
export type L2Address = `0x${string}`;

export type L1TxHash = string;
export type L2TxHash = `0x${string}`;

// TODO: everything about L1 is very WIP, should be checked with sCrypt team

export type L1TxId = {
  type: 'l1tx';
  hash: L1TxHash;
};

export type L1TxStatus = L1TxId & (
  | {
    status: 'UNCONFIRMED' | 'DROPPED';
  }
  | {
    status: 'MINED',
    blockNumber: number
  });

export type L1Tx = L1TxStatus; // TODO: What else should go into a l1 tx?

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
  deposits: Deposit[];
};

export type DepositAggregationState = DepositAggregatorState & {
  tx: L1Tx
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
    } & DepositBatchCommon)
  | ({
      status: 'FINALIZED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_TO_L2';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      depositTx: L2TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'DEPOSITED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      depositTx: L2TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_COMPLETION';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      depositTx: L2Tx;
      verifyTx: L1Tx;
    } & DepositBatchCommon)
  | ({
      status: 'COMPLETED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      depositTx: L2Tx;
      verifyTx: L1Tx;
    } & DepositBatchCommon);

export type Withdrawal = {
  amount: bigint;
  recipient: L1Address;
  origin: L2TxHash;
  blockNumber: number;
};

type WithdrawalBatchCommon = {
  id: bigint;
  withdrawals: Withdrawal[];
};

export type WithdrawalBatch =
  | ({
      status: 'PENDING';
      id: bigint;
      withdrawals: Withdrawal[];
    } & WithdrawalBatchCommon)
  | ({
      status: 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED';
      withdrawals: Withdrawal[];
      closeWithdrawalBatchTx: L2Tx;
    } & WithdrawalBatchCommon)
  | ({
      status: 'CLOSED';
      withdrawals: Withdrawal[];
      hash: string;
      closeWithdrawalBatchTx: L2Tx;
    } & WithdrawalBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_EXPANSION';
      withdrawals: Withdrawal[];
      hash: string;
      closeWithdrawalBatchTx: L2Tx;
      withdrawBatchTx: L1Tx;
    } & WithdrawalBatchCommon)
  | ({
      status: 'BEING_EXPANDED';
      withdrawals: Withdrawal[];
      hash: string;
      closeWithdrawalBatchTx: L2Tx;
      withdrawBatchTx: L1Tx;
      expansionTxs: L1Tx[][];
    } & WithdrawalBatchCommon)
  | ({
      status: 'EXPANDED';
      withdrawals: Withdrawal[];
      hash: string;
      closeWithdrawalBatchTx: L2Tx;
      withdrawBatchTx: L1Tx;
      expansionTxs: L1Tx[][];
    } & WithdrawalBatchCommon);

export type OperatorState = {
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

export type BlockNumberEvent =
  | { type: 'l1BlockNumber'; blockNumber: number }
  | { type: 'l2BlockNumber'; blockNumber: number };

export type BridgeEvent = L2Event | Deposits | BlockNumberEvent;

export type TransactionId = L1TxId | L2TxId;

export type TransactionStatus = L1TxStatus | L2TxStatus;

export type Transaction = L1Tx | L2Tx;

export type OperatorChange = BridgeEvent | TransactionStatus | BlockNumberEvent;

export type BridgeEnvironment = {
  MAX_DEPOSIT_BLOCK_AGE: number;
  DEPOSIT_BATCH_SIZE: number;
  MAX_WITHDRAWAL_BLOCK_AGE: number;
  MAX_WITHDRAWAL_BATCH_SIZE: number;
  aggregateDeposits: (batch: DepositBatch) => Promise<{txs: L1Tx[], replace: boolean}>;
  aggregateDeposits2: (level: DepositAggregationState[]) => Promise<DepositAggregationState[]>;
  finalizeBatch: (batch: DepositBatch) => Promise<L1Tx>;
  finalizeBatch2: (level2: DepositAggregationState) => Promise<L1Tx>;
  submitDepositsToL2: (hash: L1TxHash, deposits: Deposit[]) => Promise<L2Tx>;
  closePendingWithdrawalBatch: () => Promise<L2Tx>;
};

let i = 0;

export async function applyChange(
  env: BridgeEnvironment,
  state: OperatorState,
  change: OperatorChange
): Promise<OperatorState> {
  let li = i++;
  console.log('================================');
  console.log(li, 'change:');
  console.dir(change, { depth: null });

  const newState = cloneDeep(state);

  switch (change.type) {
    case 'deposits': {
      newState.pendingDeposits.push(...change.deposits);
      newState.l1BlockNumber = Math.max(
        newState.l1BlockNumber,
        max(change.deposits.map((d) => d.origin.status === 'MINED' && d.origin.blockNumber || 0)) || 0
      );
      await initiateAggregation(env, newState);
      break;
    }
    case 'l1tx': {
      updateL1TxStatus(newState, change);
      await manageAggregation(env, newState);
      break;
    }
    case 'l1BlockNumber': {
      newState.l1BlockNumber = Math.max(
        newState.l1BlockNumber,
        change.blockNumber
      );
      await initiateAggregation(env, newState);
      await manageAggregation(env, newState);
      break;
    }
    case 'l2BlockNumber': {
      newState.l2BlockNumber = Math.max(
        newState.l2BlockNumber,
        change.blockNumber
      );
      await closeWithdrawalBatch(env, newState);
      break;
    }

    case 'withdrawal': {
      newState.l2BlockNumber = Math.max(
        newState.l2BlockNumber,
        change.blockNumber
      );
      await handleWithdrawal(newState, change);
      await closeWithdrawalBatch(env, newState);
      break;
    }
    case 'closeBatch': {
      updateWithdrawalBatch(env, newState, change);
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

  console.log(li, 'state:');
  console.dir(newState, { depth: null });

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
        if (aggArray[i].tx.hash === tx.hash) {
          aggArray[i].tx.status = tx.status;
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
      l1Txs.push(...txArray.map(({ tx }) => tx));
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
      .filter((tx) => tx.status !== 'MINED')
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
    depositsOldEnough(env, state)
  ) {
    const batchSize = Math.min(
      2 ** Math.floor(Math.log2(state.pendingDeposits.length)),
      env.DEPOSIT_BATCH_SIZE
    );
    console.log('aggregating', batchSize, 'deposits');

    const deposits = state.pendingDeposits.splice(0, batchSize);

    const level0: DepositAggregationState[] = deposits.map(({origin, amount, recipient}) => ({
      type: 'LEAF',
      level: 0n,
      tx: origin,
      depositAmt: amount,
      depositAddress: l2AddressToHex(recipient)
    }));

    if (batchSize === 1) {
      // if there is only one deposit, we can finalize the batch directly
      const finalizeBatchTx = await env.finalizeBatch2(level0[0]);
      state.depositBatches.push({
        status: 'AGGREGATED',
        deposits,
        aggregationTxs: [level0],
        finalizeBatchTx,
      });
    } else {
      const aggregationTxs: DepositAggregationState[][] = [
        level0,
        await env.aggregateDeposits2(level0)
      ];
      state.depositBatches.push({
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
      deposit.origin.blockNumber + env.MAX_DEPOSIT_BLOCK_AGE <
      state.l1BlockNumber
    ) {
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
      const aggregationTxs = batch.aggregationTxs.at(-1)!;
      if (
        aggregationTxs.every((tx) => tx.tx.status === 'MINED')
      ) {
        if (aggregationTxs.length === 1) {
          const finalizeBatchTx = await env.finalizeBatch2(aggregationTxs.at(0)!);
          newState.depositBatches[i] = {
            ...batch,
            status: 'AGGREGATED',
            finalizeBatchTx,
          };
        } else {
          const newAggregationLevel =
            await env.aggregateDeposits2(batch.aggregationTxs.at(-1)!);
          batch.aggregationTxs.push(newAggregationLevel);
        }
      }
    }
    if (
      batch.status === 'AGGREGATED' &&
      batch.finalizeBatchTx.status === 'MINED'
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
async function closeWithdrawalBatch(
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
      state.withdrawalBatches[i] = {
        ...batch,
        status: 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED',
        closeWithdrawalBatchTx: await env.closePendingWithdrawalBatch(),
      };
    }
  }
}

async function updateWithdrawalBatch(
  env: BridgeEnvironment,
  state: OperatorState,
  change: L2Event
) {
  if (change.type === 'closeBatch') {
    for (let i = 0; i < state.withdrawalBatches.length; i++) {
      const batch = state.withdrawalBatches[i];
      if (batch.id === change.id) {
        assert(batch.status === 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED');
        if (batch.status === 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED') {
          state.withdrawalBatches[i] = {
            ...batch,
            status: 'CLOSED',
            hash: change.root,
          };
        }
      }
    }
  }
}

function withdrawalsOldEnough(
  env: BridgeEnvironment,
  blockNumber: number,
  withdrawals: Withdrawal[]
): boolean {
  for (const withdrawal of withdrawals) {
    if (withdrawal.blockNumber + env.MAX_WITHDRAWAL_BLOCK_AGE < blockNumber) {
      return true;
    }
  }
  return false;
}
