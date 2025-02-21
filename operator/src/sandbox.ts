import { Account, cairo, constants, RpcProvider } from 'starknet';
import {importAddressesIntoNode, prepareL1} from './l1/prepare'
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
  BridgeCovenantState,
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
  load,
  OperatorState,
  save,
} from './state';
import { setupOperator } from './operator';
// import { aggregateDeposits, finalizeBatch } from './l1/l1mocks';
import { l1TransactionStatus, aggregateDeposits, finalizeDepositBatch, verifyDepositBatch } from './l1/transactions';
import { deposits, l1BlockNumber } from './l1/events';
import { EMPTY, from, merge, of, Subject } from 'rxjs';
import { aggregateLevelDeposits, createBridgeContract } from './l1/api';
import { existsSync } from 'fs';
import path from 'path';
import { loadContractArtifacts } from 'l1';
import * as env from './l1/env'

async function initialState(path: string): Promise<OperatorState> {
  loadContractArtifacts()
  await importAddressesIntoNode()
  if (existsSync(path)) {
    return load(path)
  } else {
    const bridgeState = await createBridgeContract(
      env.operatorSigner,
      env.l1Network,
      env.createUtxoProvider(),
      env.createChainProvider(),
      env.l1FeeRate
    );
    return {
      l1BlockNumber: 0,
      l2BlockNumber: 0,
      bridgeState,
      depositBatches: [],
      withdrawalBatches: [],
      pendingDeposits: [],
    };
  }
}

async function sandboxOperator() {

  const path = './operator_state.json';

  const startState = await initialState(path);

  const env: BridgeEnvironment = {
    DEPOSIT_BATCH_SIZE: 4,
    MAX_DEPOSIT_BLOCK_AGE: 4,
    MAX_WITHDRAWAL_BLOCK_AGE: 2,
    MAX_WITHDRAWAL_BATCH_SIZE: 2,
    submitDepositBatchToL2: async (
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
    aggregateDeposits: aggregateDeposits,
    finalizeDepositBatch: finalizeDepositBatch,
    verifyDepositBatch
  };

  const operator = setupOperator(
    startState,
    env,
    l1BlockNumber(),
    deposits(startState.l1BlockNumber),
    of(), // no l2 events for now
    l1TransactionStatus,
    (tx: L2TxId) => EMPTY,
    applyChange,
    (state) => save(path, state)
  );

  operator.subscribe((_) => {});
}

sandboxOperator().catch(console.error);
