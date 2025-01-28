import { ReceiptTx } from 'starknet';
import { L2Event } from './l2/events';
import { Observable, of } from 'rxjs';
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
      // state update transaction?
      aggregationTxs: L1TxHashAndStatus[][];
    } & DepositBatchCommon)
  | ({
      status: 'REGISTERED_ON_L1';
      aggregationTxs: L1TxHashAndStatus[][];
      stateUpdateTx: L1TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_TO_L2';
      aggregationTxs: L1TxHashAndStatus[][];
      stateUpdateTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'DEPOSITED';
      aggregationTxs: L1TxHashAndStatus[][];
      stateUpdateTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'SUBMITTED_FOR_COMPLETION';
      aggregationTxs: L1TxHashAndStatus[][];
      stateUpdateTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
      verifyTx: L1TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'COMPLETED';
      aggregationTxs: L1TxHashAndStatus[][];
      stateUpdateTx: L1TxHashAndStatus;
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
  l1BlockNumber: number;
  l2BlockNumber: number;
  total: bigint;
  pendingDeposits: Deposit[];
  depositBatches: DepositBatch[];
  withdrawalBatches: WithdrawalBatch[];
};

export type Deposits = {
  type: 'deposits';
  blockNumber: number;
  deposits: Deposit[];
};

export type BridgeEvent = ({ type: 'l2event' } & L2Event) | Deposits;

export type Transaction = L1TxHashAndStatus | L2TxHashAndStatus;

export function l2EventToEvent(e: L2Event): BridgeEvent {
  return { type: 'l2event', ...e };
}

export function applyChange(
  state: OperatorState,
  change: BridgeEvent | Transaction
): Observable<OperatorState> {
  const newState = cloneDeep(state);

  // update recent block numbers, etc
  switch (change.type) {
    case 'l2event': {
      assert(change.blockNumber >= newState.l2BlockNumber);
      newState.l2BlockNumber = change.blockNumber;
      // `event` is of type L2Event here
      console.log('Handling L2Event:', change);
      break;
    }
    case 'deposits': {
      handleDeposits(newState, change);
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
      // TODO: handle withdrawal batches
      break;
    }
    case 'l1tx': {
      handleL1Tx(newState, change);
      break;
    }
    default: {
      const _exhaustiveCheck: never = change;
      return _exhaustiveCheck;
    }
  }
  return of(newState);
}

function handleL1Tx(newState: OperatorState, change: L1TxHashAndStatus) {
  throw new Error('Function not implemented.');
}

const DEPOSIT_BATCH_SIZE = 4;
const MAX_DEPOSIT_PENDIND = 30 * 60; // 30 minutes

function handleDeposits(state: OperatorState, change: Deposits) {
  // console.log('Handling deposits:', change);
  assert(change.blockNumber >= state.l1BlockNumber);
  state.l1BlockNumber = change.blockNumber;
  state.pendingDeposits.push(...change.deposits);
  aggregateDeposits(state);
}

function aggregateDeposits(state: OperatorState) {
  while (
    state.pendingDeposits.length >= DEPOSIT_BATCH_SIZE ||
    waitedLongEnough(state.pendingDeposits)
  ) {
    const deposits = state.pendingDeposits.splice(0, DEPOSIT_BATCH_SIZE);
    state.pendingDeposits = state.pendingDeposits.slice(DEPOSIT_BATCH_SIZE);
    // TODO: send aggregation transactions, handle asynchronicity
    const aggregationTxs: L1TxHashAndStatus[][] = [];
    state.depositBatches.push({
      status: 'BEING_AGGREGATED',
      deposits,
      aggregationTxs,
    });
  }
}

function waitedLongEnough(pendingDeposits: Deposit[]): boolean {
  for (const deposit of pendingDeposits) {
    if (deposit.origin.timestamp + MAX_DEPOSIT_PENDIND > Date.now()) {
      return true;
    }
  }
  return false;
}
