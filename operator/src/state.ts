import {
  ReceiptTx,
  TransactionStatus,
  GetTransactionReceiptResponse,
} from 'starknet';
import { L2Event } from './l2/events';
import { Observable, of } from 'rxjs';
import { assert } from 'console';

type L1Address = `0x${string}`; // or bigint?
type L2Address = `0x${string}`; // or bigint?

type L1TxHash = `0x${string}`; // or bigint?
type L2TxHash = `0x${string}`; // or bigint?

// TODO: everything about L1 is very WIP, should be checked with sCrypt team
export type L1TxStatus = 'Unconfirmed' | 'Confirmed' | 'Spent'; // Orphaned, Droped?
export type L1TxHashAndStatus = {
  hash: L1TxHash;
  status: L1TxStatus;
  blockNumber: number;
};
export type L2TxHashAndStatus = {
  hash: L2TxHash;
  status: ReceiptTx;
  blockNumber: bigint;
};

export interface Deposit {
  amount: bigint;
  recipient: L2Address;
  origin: L1TxHashAndStatus;
}

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
      status: 'SUBMITTED_FOR_VERIFICATION';
      aggregationTxs: L1TxHashAndStatus[][];
      stateUpdateTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
      verifyTx: L1TxHashAndStatus;
    } & DepositBatchCommon)
  | ({
      status: 'VERIFIED';
      aggregationTxs: L1TxHashAndStatus[][];
      stateUpdateTx: L1TxHashAndStatus;
      depositTx: L2TxHashAndStatus;
      verifyTx: L1TxHashAndStatus;
    } & DepositBatchCommon);

interface Withdrawal {
  amount: bigint;
  recipient: L1Address;
  origin: L2TxHash;
}

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
      status: 'SUBMITTED_FOR_VERIFICATION';
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

export class OperatorState {
  l1BlockNumber: number = 0;
  l2BlockNumber: number = 0;
  total: bigint = 0n;
  pendingDeposits: Deposit[] = [];
  depositBatches: DepositBatch[] = [];
  withdrawalBatches: WithdrawalBatch[] = [];
}

export type Event =
  | ({ type: 'l2event' } & L2Event)
  | ({ type: 'deposits'; blockNumber: number } & Deposit[]); // add blocknumber, etc

export type Transaction =
  | ({ type: 'l2tx' } & L2TxHashAndStatus)
  | ({ type: 'l1tx' } & L1TxHashAndStatus);

export function l2TxHashAndStatusToTransaction(
  tx: L2TxHashAndStatus
): Transaction {
  return { type: 'l2tx', ...tx };
}

export function l2EventToEvent(e: L2Event): Event {
  return { type: 'l2event', ...e };
}

export function applyChange(
  state: OperatorState,
  change: Event | Transaction
): Observable<OperatorState> {
  let newState = { ...state };
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
      assert(change.blockNumber >= newState.l1BlockNumber);
      newState.l1BlockNumber = change.blockNumber;
      newState.pendingDeposits.push(...change);
      if (newState.pendingDeposits.length >= 10) {
        // TODO: add actual criteria to close the batch
        const deposits = newState.pendingDeposits.splice(0, 10);
        newState.pendingDeposits = newState.pendingDeposits.slice(10);
        // TODO: send aggregation transactions, handle asyncronity
        const aggregationTxs: L1TxHashAndStatus[][] = [];
        newState.depositBatches.push({
          status: 'BEING_AGGREGATED',
          deposits,
          aggregationTxs,
        });
      }
      break;
    }
    case 'l2tx': {
      console.log('Handling L2Tx:', change);
      for (let i = 0; i < newState.depositBatches.length; i++) {
        const depositBatch = newState.depositBatches[i];
        switch (depositBatch.status) {
          case 'SUBMITTED_TO_L2':
            if (depositBatch.depositTx.hash === change.hash) {
              depositBatch.depositTx = change;
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
      // TODO: handle l1tx
      console.log('Handling L1Tx:', change);
      throw new Error('not implemented');
    }
    default: {
      const _exhaustiveCheck: never = change;
      return _exhaustiveCheck;
    }
  }

  return of(newState);
}
