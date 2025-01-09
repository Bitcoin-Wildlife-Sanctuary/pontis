import {
  ReceiptTx,
  TransactionStatus,
  GetTransactionReceiptResponse,
} from 'starknet';

type L1Address = `0x${string}`; // or bigint?
type L2Address = `0x${string}`; // or bigint?

type L1TxHash = `0x${string}`; // or bigint?
type L2TxHash = `0x${string}`; // or bigint?

export interface Deposit {
  amount: bigint;
  recipient: L2Address;
  origin: L1TxHash;
}

export type L1TxStatus = 'Unconfirmed' | 'Confirmed' | 'Spent'; // Orphaned, Droped?
export type L1TxHashAndStatus = {
  hash: L1TxHash;
  status: L1TxStatus;
};
export type L2TxHashAndStatus = {
  hash: L2TxHash;
  status: ReceiptTx;
};

type DepositBatch =
  | {
      status: 'BEING_AGGREGATED';
      deposits: Deposit[];
      aggregationTxs: L1TxHashAndStatus[][];
    }
  | {
      status: 'AGGREGATED'; // aggregation done, registered in StateContract
      deposits: Deposit[];
      // state update transaction?
      aggregationTxs: L1TxHashAndStatus[][];
    }
  | {
      status: 'SUBMITTED_TO_L2';
      deposits: Deposit[];
      aggregationTxs: L1TxHashAndStatus[][];
      l2Tx: L2TxHashAndStatus;
    }
  | {
      status: 'DEPOSITED';
      deposits: Deposit[];
      aggregationTxs: L1TxHashAndStatus[][];
      l2Tx: L2TxHashAndStatus;
    }
  | {
      status: 'SUBMITTED_FOR_VERIFICATION';
      deposits: Deposit[];
      aggregationTxs: L1TxHashAndStatus[][];
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
    }
  | {
      status: 'VERIFIED';
      deposits: Deposit[];
      aggregationTxs: L1TxHashAndStatus[][];
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
    };

interface Withdrawal {
  amount: bigint;
  recipient: L1Address;
  origin: L2TxHash;
}

type WithdrawalBatch =
  | {
      status: 'PENDING';
      withdrawals: Withdrawal[];
    }
  | {
      status: 'CLOSE_SUBMITTED';
      withdrawals: Withdrawal[];
      hash: bigint;
      l2Tx: L2TxHashAndStatus;
    }
  | {
      status: 'CLOSED';
      withdrawals: Withdrawal[];
      hash: bigint;
      l2Tx: L2TxHashAndStatus;
    }
  | {
      status: 'SUBMITTED_FOR_VERIFICATION';
      withdrawals: Withdrawal[];
      hash: bigint;
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
    }
  | {
      status: 'BEING_EXPANDED';
      withdrawals: Withdrawal[];
      hash: bigint;
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
      expansionTxs: L1TxHashAndStatus[][];
    }
  | {
      status: 'EXPANDED';
      withdrawals: Withdrawal[];
      hash: bigint;
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
      expansionTxs: L1TxHashAndStatus[][];
    };

export class OperatorState {
  l2BlockNumber: number = 0;
  total: bigint = 0n;
  pendingDeposits: Deposit[] = [];
  depositBatches: DepositBatch[] = [];
  withdrawalBatches: WithdrawalBatch[] = [];
}
