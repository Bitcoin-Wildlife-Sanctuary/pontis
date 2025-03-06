import { Account, RpcProvider } from 'starknet';
import { importAddressesIntoNode } from './l1/prepare';
import {
  closeWithdrawalBatch,
  contractFromAddress,
  submitDepositsToL2,
} from './l2/contracts';
import * as devnet from './l2/devnet';
import {
  applyChange,
  BridgeEnvironment,
  Deposit,
  L1TxHash,
  OperatorState,
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
import { deposits, l1BlockNumber, l1BridgeBalance } from './l1/events';
import { createBridgeContract } from './l1/api';
import { existsSync } from 'fs';
import * as env from './l1/env';
import { l2TransactionStatus } from './l2/transactions';
import { l2BlockNumber, l2Events, totalSupply } from './l2/events';
import { loadContractArtifacts } from './l1/utils/contractUtil';
import { load, save } from './persistence';
import { first, firstValueFrom, merge, Observable } from 'rxjs';

async function initialState(
  path: string,
  provider: RpcProvider
): Promise<OperatorState> {
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
      l1BlockNumber: (await firstValueFrom(l1BlockNumber())).blockNumber,
      l2BlockNumber: (await firstValueFrom(l2BlockNumber(provider)))
        .blockNumber,
      bridgeState,
      depositBatches: [],
      withdrawalBatches: [],
      pendingDeposits: [],
      l1BridgeBalance: 0n,
      l2TotalSupply: 0n,
      recentChanges: []
    };
  }
}

async function pocOperator() {
  const path = './state.json';

  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050/rpc' });

  const admin = new Account(
    provider,
    devnet.admin.address,
    devnet.admin.privateKey
    // undefined,
    // constants.TRANSACTION_VERSION.V3
  );

  const btcAddress =
    '0x3bf13a2032fa2fe8652266e93fd5acf213d6ddd05509b185ee4edf0c4000d5d';
  const bridgeAddress =
    '0x20e5866c53e02141b1fd22d1e02ebaf520fddfa16321a39d7f1545dd59497ae';

  const bridge = await contractFromAddress(provider, bridgeAddress);
  const btc = await contractFromAddress(provider, btcAddress);
  bridge.connect(admin);

  const startState = await initialState(path, provider);

  const env: BridgeEnvironment = {
    DEPOSIT_BATCH_SIZE: 4,
    MAX_DEPOSIT_BLOCK_AGE: 2,
    MAX_WITHDRAWAL_BLOCK_AGE: 4,
    MAX_WITHDRAWAL_BATCH_SIZE: 4,
    submitDepositsToL2: (hash: L1TxHash, deposits: Deposit[]) => {
      return submitDepositsToL2(admin, bridge, BigInt('0x' + hash), deposits);
    },
    closePendingWithdrawalBatch: (id: bigint) =>
      closeWithdrawalBatch(admin, bridge, id),
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
    merge(
      l2Events(provider, startState.l2BlockNumber, [bridgeAddress]),
      l2BlockNumber(provider),
      totalSupply(provider, btc)
    ),
    // l2Events(provider, startState.l2BlockNumber, [bridgeAddress]),
    l1TransactionStatus,
    (tx) => l2TransactionStatus(provider, tx),
    (state) => l1BridgeBalance(state),
    applyChange,
    (state) => save(path, state)
  );
  operator.subscribe((_) => {});
}

pocOperator().catch(console.error);
