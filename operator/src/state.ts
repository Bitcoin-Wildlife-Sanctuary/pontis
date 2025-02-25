import { L2Event } from './l2/events';
import { assert } from 'console';
import { cloneDeep, max } from 'lodash';
import { BridgeState, DepositAggregatorState, WithdrawalExpanderCovenant, WithdrawalExpanderState, WithdrawalExpanderState2, WithdrawalMerkle, WithdrawalNode } from 'l1';
import { l2AddressToHex } from './l1/utils/contractUtil';
import { readFileSync, writeFileSync } from 'fs';

export type L1Address = `0x${string}`;
export type L2Address = `0x${string}`;

export type L1TxHash = string;
export type L2TxHash = `0x${string}`;

// TODO: everything about L1 is very WIP, should be checked with sCrypt team

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
      batchId: string;
    } & DepositBatchCommon)
  | ({
      status: 'FINALIZED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      batchId: string;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_TO_L2';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      batchId: string;
      depositTx: L2TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'DEPOSITED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      batchId: string;
      depositTx: L2TxStatus;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_VERIFICATION';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      batchId: string;
      depositTx: L2Tx;
      verifyTx: L1Tx;
    } & DepositBatchCommon)
  | ({
      status: 'COMPLETED';
      aggregationTxs: DepositAggregationState[][];
      finalizeBatchTx: L1Tx;
      batchId: string;
      depositTx: L2Tx;
      verifyTx: L1Tx;
    } & DepositBatchCommon);

export type Withdrawal = {
  amount: bigint;
  recipient: L1Address;
  origin: L2TxHash;
  blockNumber: number;
};

export type WithdrawalExpansionState = WithdrawalExpanderState2 & {
  tx: L1Tx
}

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
      status: 'BEING_EXPANDED';
      withdrawals: Withdrawal[];
      hash: string;
      closeWithdrawalBatchTx: L2Tx;
      expansionTree: ExpansionMerkleTree;
      expansionTxs: L1Tx[][];
    } & WithdrawalBatchCommon)
  | ({
      status: 'EXPANDED';
      withdrawals: Withdrawal[];
      hash: string;
      closeWithdrawalBatchTx: L2Tx;
      expansionTree: ExpansionMerkleTree;
      expansionTxs: L1Tx[][];
    } & WithdrawalBatchCommon);

export type BridgeCovenantState = BridgeState & {
  latestTx: L1Tx;
};

export type OperatorState = {
  l1BlockNumber: number;
  l2BlockNumber: number;
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

export type BridgeEvent = L2Event | Deposits | BlockNumberEvent;

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
  closePendingWithdrawalBatch: () => Promise<L2Tx>;
  createWithdrawalExpander: (
    bridgeState: BridgeCovenantState,
    hash: string, expectedWithdrawalState: WithdrawalExpanderState
  ) => Promise<BridgeCovenantState>;
  expandWithdrawals: (
    withdrawals: Withdrawal[], hash: string, expansionTxs: L1Tx[]
  ) => Promise<L1Tx[]>;
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
        max(
          change.deposits.map(
            (d) => (d.origin.status === 'MINED' && d.origin.blockNumber) || 0
          )
        ) || 0
      );
      await initiateAggregation(env, newState);
      break;
    }
    case 'l1tx': {
      updateL1TxStatus(newState, change);
      await manageAggregation(env, newState);
      await manageVerification(env, newState);
      break;
    }
    case 'l1BlockNumber': {
      newState.l1BlockNumber = Math.max(
        newState.l1BlockNumber,
        change.blockNumber
      );
      await initiateAggregation(env, newState);
      await manageAggregation(env, newState);
      await manageVerification(env, newState);
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
      await manageVerification(env, newState);
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

function updateL1TxStatus(state: OperatorState, status: L1TxStatus) {
  function update(tx: L1Tx) {
    if (tx.hash === status.hash) {
      Object.assign(tx, status);
    }
  }

  // TODO: make sure it is complete, generated by o1
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
      wb.status === 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED' ||
      wb.status === 'CLOSED' ||
      wb.status === 'BEING_EXPANDED' ||
      wb.status === 'EXPANDED'
    ) {
      update(wb.closeWithdrawalBatchTx);
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
      wb.status === 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED' ||
      wb.status === 'CLOSED' ||
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
      // if there is only one deposit, we can finalize the batch directly
      const [bridgeState, batchId] = await env.finalizeDepositBatch(
        state.bridgeState,
        level0[0]
      );
      state.bridgeState = bridgeState;

      state.depositBatches.push({
        status: 'AGGREGATED',
        deposits,
        aggregationTxs: [level0],
        finalizeBatchTx: state.bridgeState.latestTx,
        batchId,
      });
    } else {
      const aggregationTxs: DepositAggregationState[][] = [
        level0,
        await env.aggregateDeposits(level0),
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
      if (aggregationTxs.every((tx) => tx.tx.status === 'MINED')) {
        if (aggregationTxs.length === 1) {
          const [bridgeState, batchId] = await env.finalizeDepositBatch(
            newState.bridgeState,
            aggregationTxs.at(0)!
          );
          newState.bridgeState = bridgeState;
          newState.depositBatches[i] = {
            ...batch,
            status: 'AGGREGATED',
            finalizeBatchTx: newState.bridgeState.latestTx,
            batchId,
          };
        } else {
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
      console.log('Submitting to l2 batch:', batch.batchId);
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
    if (
      depositBatch.status === 'SUBMITTED_TO_L2' &&
      depositBatch.depositTx.status === 'SUCCEEDED'
    ) {
      newState.depositBatches[i] = {
        ...depositBatch,
        status: 'DEPOSITED',
      };
    }
  }
}

async function manageVerification(
  env: BridgeEnvironment,
  newState: OperatorState
) {
  for (let i = 0; i < newState.depositBatches.length; i++) {
    const batch = newState.depositBatches[i];

    if (
      batch.status === 'DEPOSITED' &&
      batch.depositTx.status === 'SUCCEEDED'
    ) {
      newState.bridgeState = await env.verifyDepositBatch(
        newState.bridgeState,
        batch.batchId
      );
      newState.depositBatches[i] = {
        ...batch,
        status: 'SUBMITTED_FOR_VERIFICATION',
        depositTx: await env.submitDepositsToL2(
          batch.finalizeBatchTx.hash,
          batch.deposits
        ),
        verifyTx: newState.bridgeState.latestTx,
      };
    }

    if (
      batch.status === 'SUBMITTED_FOR_VERIFICATION' &&
      batch.verifyTx.status === 'MINED'
    ) {
      newState.depositBatches[i] = {
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
        // TODO: make sure which batch we are closing, it might be closed by external tx
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
        assert(batch.status === 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED' || batch.status == 'PENDING');
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

async function initiateWithdrawalsExpansion(env: BridgeEnvironment, state: OperatorState) {
  // iterate over withdrawal batches and find CLOSED one
  for (let i = 0; i < state.withdrawalBatches.length; i++) {
    const batch = state.withdrawalBatches[i];
    if (batch.status === 'CLOSED') {
      const expansionTree = WithdrawalMerkle.getMerkleTree(batch.withdrawals.map(w => ({
        l1Address: w.recipient,
        amt: w.amount
      })));

      const expectedWithdrawalState = WithdrawalMerkle.getStateForHashFromTree(
        expansionTree, expansionTree.root
      );
      
      const bridgeState = await env.createWithdrawalExpander(
        state.bridgeState,
        batch.hash,
        expectedWithdrawalState, 
      );

      state.bridgeState = bridgeState;

      state.withdrawalBatches[i] = {
        ...batch,
        status: 'BEING_EXPANDED',
        expansionTree,
        expansionTxs: [[bridgeState.latestTx]],
      };
    }
  }
}

async function manageExpansion(env: BridgeEnvironment, state: OperatorState) {
  for (let i = 0; i < state.withdrawalBatches.length; i++) {
    const batch = state.withdrawalBatches[i];
    if (batch.status === 'BEING_EXPANDED') {
      const expansionTxs = batch.expansionTxs.at(-1);
      if (expansionTxs && expansionTxs.every((tx) => tx.status === 'MINED')) {
        if (expansionTxs.length === batch.withdrawals.length) {
          state.withdrawalBatches[i] = {
            ...batch,
            status: 'EXPANDED',
          };
        } else {
          const newExpansionLevel = await env.expandWithdrawals(
            batch.withdrawals, batch.hash, expansionTxs
          );
          batch.expansionTxs.push(newExpansionLevel);
        }
      }
    }
  }
}

export function save(path: string, state: OperatorState) {
  const jsonString = JSON.stringify(
    state,
    (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString() + 'n';
      }
      return value;
    },
    2
  );

  writeFileSync(path, jsonString, 'utf8');
}

export function load(path: string): OperatorState {
  const rawData = readFileSync(path, 'utf8');

  const state = JSON.parse(rawData, (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  });

  return state as OperatorState;
}

