import { Account, cairo, constants, RpcProvider } from 'starknet';
import {prepareL1} from './l1/prepare'
import { contractEvents, l2BlockNumber, l2Events } from './l2/events';
import {
  closePendingWithdrawalBatch,
  contractFromAddress,
  init,
  l2TxStatus,
  submitDepositsToL2,
  toDigest,
} from './l2/contracts';
import * as devnet from './l2/devnet';
import {
  applyChange,
  BridgeEnvironment,
  Deposit,
  DepositAggregationState,
  DepositBatch,
  Deposits,
  L1Tx,
  L1TxHash,
  L1TxId,
  L1TxStatus,
  L2Tx,
  L2TxId,
  L2TxStatus,
  OperatorState,
} from './state';
import { setupOperator } from './operator';
// import { aggregateDeposits, finalizeBatch } from './l1/l1mocks';
import { l1TransactionStatus, aggregateDeposits, finalizeBatch, aggregateDeposits2, finalizeBatch2 } from './l1/transactions';
import { deposits, l1BlockNumber } from './l1/events';
import { EMPTY, from, merge, of, Subject } from 'rxjs';
import { aggregateLevelDeposits2 } from './l1/api';

async function sandboxOperator() {
  await prepareL1()
  const initialState: OperatorState = {
    l1BlockNumber: 0,
    l2BlockNumber: 0,
    total: 0n,
    depositBatches: [],
    withdrawalBatches: [],
    pendingDeposits: [],
  };

  function saveState(state: OperatorState) {}

  const env: BridgeEnvironment = {
    DEPOSIT_BATCH_SIZE: 4,
    MAX_DEPOSIT_BLOCK_AGE: 4,
    MAX_WITHDRAWAL_BLOCK_AGE: 2,
    MAX_WITHDRAWAL_BATCH_SIZE: 2,
    aggregateDeposits: async (batch: DepositBatch) => aggregateDeposits(batch),
    finalizeBatch: async (batch: DepositBatch) => finalizeBatch(batch),
    submitDepositsToL2: async (
      hash: L1TxHash,
      deposits: Deposit[]
    ): Promise<L2Tx> => {
      console.warn('submitDepositsToL2 Not implemented');
      return {
        type: 'l2tx',
        hash: "0x123456789",
        status: 'PENDING'
      };
    },
    closePendingWithdrawalBatch: async (): Promise<L2Tx> => {
      throw new Error('Not implemented');
    },
    aggregateDeposits2: (level: DepositAggregationState[]) => aggregateDeposits2(level),
    finalizeBatch2: (root: DepositAggregationState) => finalizeBatch2(root)
  };

  const operator = setupOperator(
    initialState,
    env,
    l1BlockNumber(),
    deposits(initialState.l1BlockNumber),
    of(), // no l2 events for now
    l1TransactionStatus,
    (tx: L2TxId) => EMPTY,
    applyChange,
    saveState
  );

  operator.subscribe((_) => {});
}

sandboxOperator().catch(console.error);
