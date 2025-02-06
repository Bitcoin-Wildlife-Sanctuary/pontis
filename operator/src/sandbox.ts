import { Account, cairo, constants, RpcProvider } from 'starknet';

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
import { aggregateDeposits, finalizeBatch } from './l1/l1mocks';
import { l1TransactionStatus } from './l1/transactions';
import { deposits, l1BlockNumber } from './l1/events';
import { merge, of, Subject } from 'rxjs';

async function sandboxOperator() {
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
    aggregateDeposits: async (txs: L1Tx[]) => aggregateDeposits(txs),
    finalizeBatch: async (tx: L1Tx) => finalizeBatch(tx),
    submitDepositsToL2: async (
      hash: L1TxHash,
      deposits: Deposit[]
    ): Promise<L2Tx> => {
      throw new Error('Not implemented');
    },
    closePendingWithdrawalBatch: async (): Promise<L2Tx> => {
      throw new Error('Not implemented');
    },
  };

  const manualDesposits = new Subject<Deposits>();

  const operator = setupOperator(
    initialState,
    env,
    of(), // no block events for now
    merge(
      l1BlockNumber(),
      deposits(initialState.l1BlockNumber),
      manualDesposits
    ),
    of(), // no l2 events for now
    l1TransactionStatus,
    (tx: L2TxId) => {
      throw new Error('Not implemented');
    },
    applyChange,
    saveState
  );

  operator.subscribe((_) => {});

  // this is how you would manually trigger a deposit:
  // send a transaction, then call next on the subject
  // operator will pick it up and process it
  // manualDesposits.next(...)
}

sandboxOperator().catch(console.error);
