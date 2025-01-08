type L1Address = `0x${string}`; // or BigInt?
type L2Address = `0x${string}`; // or BigInt?

type L1TxHash = `0x${string}`; // or BigInt?
type L2TxHash = `0x${string}`; // or BigInt?

interface Deposit {
  amount: BigInt;
  recipient: L2Address;
  origin: L1TxHash;
}

type L1TxStatus = 'Unconfirmed' | 'Confirmed' | 'Spent'; // Orphaned, Droped?
type L1TxHashAndStatus = {
  hash: L1TxHash;
  status: L1TxStatus;
};
type L2TxStatus = 'RECEIVED' | 'ACCEPETD'; // is it precise enough
type L2TxHashAndStatus = {
  hash: L2TxHash;
  status: L2TxStatus;
};

type DepositBatch =
  | {
      status: 'BEING_AGGREGATED';
      deposits: Deposit[];
      aggregationTxs: L2TxHashAndStatus[][];
    }
  | {
      status: 'AGGREGATED'; // aggregation done, registered in StateContract
      deposits: Deposit[];
      // state update transaction?
      aggregationTxs: L2TxHashAndStatus[][];
    }
  | {
      status: 'SUBMITTED_TO_L2';
      deposits: Deposit[];
      aggregationTxs: L2TxHashAndStatus[][];
      l2Tx: L2TxHashAndStatus;
    }
  | {
      status: 'DEPOSITED';
      deposits: Deposit[];
      aggregationTxs: L2TxHashAndStatus[][];
      l2Tx: L2TxHashAndStatus;
    }
  | {
      status: 'SUBMITTED_FOR_VERIFICATION';
      deposits: Deposit[];
      aggregationTxs: L2TxHashAndStatus[][];
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
    }
  | {
      status: 'VERIFIED';
      deposits: Deposit[];
      aggregationTxs: L2TxHashAndStatus[][];
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
    };

interface Withdrawal {
  amount: BigInt;
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
      hash: BigInt;
      l2Tx: L2TxHashAndStatus;
    }
  | {
      status: 'CLOSED';
      withdrawals: Withdrawal[];
      hash: BigInt;
      l2Tx: L2TxHashAndStatus;
    }
  | {
      status: 'SUBMITTED_FOR_VERIFICATION';
      withdrawals: Withdrawal[];
      hash: BigInt;
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
    }
  | {
      status: 'BEING_EXPANDED';
      withdrawals: Withdrawal[];
      hash: BigInt;
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
      expansionTxs: L1TxHashAndStatus[][];
    }
  | {
      status: 'EXPANDED';
      withdrawals: Withdrawal[];
      hash: BigInt;
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
      expansionTxs: L1TxHashAndStatus[][];
    };

class OperatorState {
  total: BigInt = 0n;
  pendingDeposits: Deposit[] = [];
  depositBatches: DepositBatch[] = [];
  withdrawalBatches: WithdrawalBatch[] = [];
}
