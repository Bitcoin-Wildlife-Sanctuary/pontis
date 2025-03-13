import { logger, RpcProvider } from 'starknet';
import { importAddressesIntoNode } from './l1/prepare';
import { closeWithdrawalBatch, submitDepositsToL2 } from './l2/contracts';
import { applyChange, BridgeEnvironment, L1TxId, OperatorState } from './state';
import { setupOperator } from './operator';
import {
  deposits,
  l1BlockNumber,
  l1BridgeBalance,
  l1TransactionStatus,
} from './l1/events';
import { existsSync } from 'fs';
import { l2TransactionStatus } from './l2/transactions';
import { l2BlockNumber, l2Events, totalSupply } from './l2/events';
import { loadContractArtifacts } from './l1/utils/contractUtil';
import { load, save } from './persistence';
import { firstValueFrom, from, merge } from 'rxjs';
import { Config, getConfig } from './config';
import {
  aggregateLevelDeposits,
  createBridgeContract,
  createWithdrawal,
  distributeLevelWithdrawals,
  expandLevelWithdrawals,
  finalizeDepositBatchOnL1,
  getL1TransactionStatus,
  verifyDepositBatch,
} from './l1/api';

async function initialState(config: Config): Promise<OperatorState> {
  loadContractArtifacts();
  await importAddressesIntoNode(config);
  if (existsSync(config.STATE_PATH)) {
    return load(config.STATE_PATH);
  } else {
    const bridgeState = await createBridgeContract(
      config.l1.operatorSigner,
      config.l1.network,
      config.l1.createUtxoProvider(),
      config.l1.createChainProvider(),
      config.l1.feeRate
    );
    return {
      l1BlockNumber: (
        await firstValueFrom(l1BlockNumber(config.l1.createL1Provider()))
      ).blockNumber,
      l2BlockNumber: (await firstValueFrom(l2BlockNumber(config.l2.provider)))
        .blockNumber,
      bridgeState,
      depositBatches: [],
      withdrawalBatches: [],
      pendingDeposits: [],
      l1BridgeBalance: 0n,
      l2TotalSupply: 0n,
      lastDepositBatchId: 0n,
    };
  }
}

async function pocOperator() {
  const config = await getConfig();

  const startState = await initialState(config);

  const operatorEnv: BridgeEnvironment = {
    DEPOSIT_BATCH_SIZE: config.DEPOSIT_BATCH_SIZE,
    MAX_DEPOSIT_BLOCK_AGE: config.MAX_DEPOSIT_BLOCK_AGE,
    MAX_WITHDRAWAL_BLOCK_AGE: config.MAX_WITHDRAWAL_BLOCK_AGE,
    MAX_WITHDRAWAL_BATCH_SIZE: config.MAX_WITHDRAWAL_BATCH_SIZE,
    submitDepositsToL2: (hash, deposits) =>
      submitDepositsToL2(
        config.l2.admin,
        config.l2.bridge,
        BigInt('0x' + hash),
        deposits
      ),
    closePendingWithdrawalBatch: (id) =>
      closeWithdrawalBatch(config.l2.admin, config.l2.bridge, id),
    aggregateDeposits: (level) =>
      aggregateLevelDeposits(
        config.l1.operatorSigner,
        config.l1.network,
        config.l1.createEnhancedProvider(),
        config.l1.feeRate,
        level
      ),
    finalizeDepositBatch: (bridgeState, root) =>
      finalizeDepositBatchOnL1(
        config.l1.operatorSigner,
        config.l1.network,
        config.l1.createUtxoProvider(),
        config.l1.createChainProvider(),
        config.l1.createL1Provider(),
        config.l1.feeRate,
        root,
        bridgeState
      ),
    verifyDepositBatch: async (bridgeState, batchId) =>
      verifyDepositBatch(
        config.l1.operatorSigner,
        config.l1.network,
        config.l1.createUtxoProvider(),
        config.l1.createChainProvider(),
        config.l1.createL1Provider(),
        config.l1.feeRate,
        bridgeState,
        batchId
      ),
    createWithdrawalExpander: async (
      bridgeState,
      hash,
      expectedWithdrawalState
    ) =>
      createWithdrawal(
        config.l1.operatorSigner,
        config.l1.network,
        config.l1.createUtxoProvider(),
        config.l1.createChainProvider(),
        config.l1.createL1Provider(),
        config.l1.feeRate,
        bridgeState,
        hash,
        expectedWithdrawalState
      ),
    expandWithdrawals: async (level, expansionTxs) =>
      expandLevelWithdrawals(
        config.l1.operatorSigner,
        config.l1.network,
        config.l1.createEnhancedProvider(),
        config.l1.feeRate,
        level,
        expansionTxs
      ),
    distributeWithdrawals: async (level, expansionTxs) =>
      distributeLevelWithdrawals(
        config.l1.operatorSigner,
        config.l1.network,
        config.l1.createEnhancedProvider(),
        config.l1.feeRate,
        level,
        expansionTxs
      ),
  };

  const l1TxStatus = (tx: L1TxId) =>
    l1TransactionStatus(config.l1.createL1Provider(), tx);

  const operator = setupOperator(
    startState,
    operatorEnv,
    l1BlockNumber(config.l1.createL1Provider()),
    deposits(config, startState.l1BlockNumber),
    merge(
      l2Events(config.l2.provider, startState.l2BlockNumber, [
        config.l2.bridge.address,
      ]),
      l2BlockNumber(config.l2.provider),
      totalSupply(config.l2.provider, config.l2.btc)
    ),
    l1TxStatus,
    (tx) => l2TransactionStatus(config.l2.provider, tx),
    (state) => l1BridgeBalance(config, state),
    applyChange,
    (state) => save(config.STATE_PATH, state)
  );
  operator.subscribe((_) => {});
}

pocOperator().catch(logger.error);
