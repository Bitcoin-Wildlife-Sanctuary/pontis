import { Account, RpcProvider } from 'starknet';
import { importAddressesIntoNode } from './l1/prepare';
import {
  closePendingWithdrawalBatch,
  contractFromAddress,
  submitDepositsToL2,
} from './l2/contracts';
import * as devnet from './l2/devnet';
import {
  applyChange,
  BridgeEnvironment,
  Deposit,
  L1TxHash,
  load,
  OperatorState,
  save,
} from './state';
import { setupOperator } from './operator';
// import { aggregateDeposits, finalizeBatch } from './l1/l1mocks';
import {
  l1TransactionStatus,
  aggregateDeposits,
  finalizeDepositBatch,
  verifyDepositBatch,
  expandWithdrawals,
  createWithdrawalExpander,
  distributeWithdrawals,
} from './l1/transactions';
import { deposits, l1BlockNumber } from './l1/events';
import { createBridgeContract } from './l1/api';
import { existsSync } from 'fs';
import * as env from './l1/env';
import { l2TransactionStatus } from './l2/transactions';
import { l2Events } from './l2/events';
import { loadContractArtifacts } from './l1/utils/contractUtil';

async function initialState(path: string): Promise<OperatorState> {
  loadContractArtifacts();
  await importAddressesIntoNode();
  if (existsSync(path)) {
    return load(path);
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

  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050/rpc' });

  const admin = new Account(
    provider,
    devnet.admin.address,
    devnet.admin.privateKey
    // undefined,
    // constants.TRANSACTION_VERSION.V3
  );

  const btcAddress = `0x7071546bd5561c25948f3307c160409a23493608d0afdda4dbfbe597a7d45fc`;
  const bridgeAddress =
    '0xc23926ac357faf16ce9a043f547228e99a3e89510d893fa0a7b2c9351865ab';

  const bridge = await contractFromAddress(provider, bridgeAddress);
  const btc = await contractFromAddress(provider, btcAddress);
  bridge.connect(admin);

  const startState = await initialState(path);

  const env: BridgeEnvironment = {
    DEPOSIT_BATCH_SIZE: 4,
    MAX_DEPOSIT_BLOCK_AGE: 2,
    MAX_WITHDRAWAL_BLOCK_AGE: 2,
    MAX_WITHDRAWAL_BATCH_SIZE: 2,
    submitDepositsToL2: (hash: L1TxHash, deposits: Deposit[]) => {
      return submitDepositsToL2(admin, bridge, BigInt('0x' + hash), deposits);
    },
    closePendingWithdrawalBatch: (id: bigint) =>
      closePendingWithdrawalBatch(admin, bridge, id),
    aggregateDeposits,
    finalizeDepositBatch,
    verifyDepositBatch,
    createWithdrawalExpander,
    expandWithdrawals,
    distributeWithdrawals,
  };

  // l2Events(provider, startState.l2BlockNumber, [bridgeAddress]).subscribe(console.log);

  const operator = setupOperator(
    startState,
    env,
    l1BlockNumber(),
    deposits(startState.l1BlockNumber),
    //    merge(l2Events(provider, startState.l2BlockNumber, [bridgeAddress]), l2BlockNumber(provider)),
    l2Events(provider, startState.l2BlockNumber, [bridgeAddress]),
    l1TransactionStatus,
    (tx) => l2TransactionStatus(provider, tx),
    applyChange,
    (state) => save(path, state)
  );
  operator.subscribe((_) => {});
}

sandboxOperator().catch(console.error);
