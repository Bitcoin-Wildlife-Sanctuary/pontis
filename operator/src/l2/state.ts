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

interface UTXO {
  txid: L1TxHash;
  index: BigInt;
  status: L1TxStatus;
}

type DepositBatch =
  | {
      status: 'PENDING';
      deposits: Deposit[];
      depositsUTOXs: UTXO[];
    }
  | {
      status: 'BEING_AGGREGATED';
      deposits: Deposit[];
      aggregationUTOXs: UTXO[];
    }
  | {
      status: 'AGGREGATED';
      deposits: Deposit[];
    }
  | {
      status: 'SUBMITTED_TO_L2';
      deposits: Deposit[];
      l1Tx: L2TxHashAndStatus;
    }
  | {
      status: 'DEPOSITED';
      deposits: Deposit[];
      l1Tx: L2TxHashAndStatus;
    }
  | {
      status: 'SUBMITTED_FOR_VERIFICATION';
      deposits: Deposit[];
      l1Tx: L2TxHashAndStatus;
      l2Tx: L1TxHashAndStatus;
    }
  | {
      status: 'VERIFIED';
      deposits: Deposit[];
      l1Tx: L2TxHashAndStatus;
      l2Tx: L1TxHashAndStatus;
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
      expansionUTOXs: UTXO[];
    }
  | {
      status: 'EXPANDED';
      withdrawals: Withdrawal[];
      hash: BigInt;
      l2Tx: L2TxHashAndStatus;
      l1Tx: L1TxHashAndStatus;
      expansionUTOXs: UTXO[];
    };

class OperatorState {
  total: BigInt = 0n;
  deposits: DepositBatch[] = [];
  withdrawals: WithdrawalBatch[] = [];
}
