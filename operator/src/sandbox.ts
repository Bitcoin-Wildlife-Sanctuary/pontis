import { Account, RpcProvider } from 'starknet';
import {importAddressesIntoNode} from './l1/prepare'
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
  L2TxId,
  load,
  OperatorState,
  save,
} from './state';
import { setupOperator } from './operator';
// import { aggregateDeposits, finalizeBatch } from './l1/l1mocks';
import { l1TransactionStatus, aggregateDeposits, finalizeDepositBatch, verifyDepositBatch } from './l1/transactions';
import { deposits, l1BlockNumber } from './l1/events';
import { EMPTY, merge, of } from 'rxjs';
import { createBridgeContract } from './l1/api';
import { existsSync } from 'fs';
import * as env from './l1/env'
import { l2TransactionStatus } from './l2/transactions';
import { l2BlockNumber, l2Events } from './l2/events';
import { loadContractArtifacts } from './l1/utils/contractUtil'

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
    '0x60321d40770d02cb85583a78a5267f3e7b37f82006e11b9916fd37d91dd956c';

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
      return submitDepositsToL2(admin, bridge, BigInt('0x' + hash), deposits)
    },
    closePendingWithdrawalBatch: () => closePendingWithdrawalBatch(admin, bridge),
    aggregateDeposits,
    finalizeDepositBatch,
    verifyDepositBatch
  };

  const operator = setupOperator(
    startState,
    env,
    l1BlockNumber(),
    deposits(startState.l1BlockNumber),
//    merge(l2Events(provider, startState.l2BlockNumber, [bridgeAddress]), l2BlockNumber(provider)),
    l2Events(provider, startState.l2BlockNumber, [bridgeAddress]),
    l1TransactionStatus,
    tx => l2TransactionStatus(provider, tx),
    applyChange,
    state => save(path, state)
  );

  operator.subscribe((_) => {});

  // console.log("stating");
  // l2TransactionStatus(provider, {
  //   type: 'l2tx',
  //   hash: '0x2d1ebc1d7e6a58010e6c7a8e2dad1885d3ea32a093a32e1316fe0c8d5ceac45',
  // }).subscribe(console.log)
}

sandboxOperator().catch(console.error);
