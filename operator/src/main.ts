import { Account, cairo, constants, RpcProvider } from 'starknet';

import { contractEvents } from './l2/events';
import {
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
  L1Tx,
  L1TxHash,
  L1TxStatus,
  L2Tx,
  L2TxId,
  L2TxStatus,
  OperatorState,
} from './state';
import { setupOperator } from './operator';
import { mocked, MockEvent } from './mock';
import { aggregateDeposits, finalizeBatch } from './l1/l1mocks';

async function mockedOperator() {
  const events: MockEvent[] = [
    // first deposit
    {
      type: 'deposits',
      deposits: [
        {
          amount: 100n,
          recipient:
            '0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1',
          origin: {
            type: 'l1tx',
            hash: '0xabc',
            status: 'Mined',
            timestamp: 1,
          },
        },
      ],
    },

    // second deposit
    {
      type: 'deposits',
      deposits: [
        {
          amount: 200n,
          recipient:
            '0x049dfb8ce986e21d354ac93ea65e6a11f639c1934ea253e5ff14ca62eca0f38e',
          origin: {
            type: 'l1tx',
            hash: '0xabd',
            status: 'Mined',
            timestamp: 2,
          },
        },
      ],
    },
    // third and fourth deposit
    {
      type: 'deposits',
      deposits: [
        {
          amount: 300n,
          recipient:
            '0x04f348398f859a55a0c80b1446c5fdc37edb3a8478a32f10764659fc241027d3',
          origin: {
            type: 'l1tx',
            hash: '0xabe',
            status: 'Mined',
            timestamp: 3,
          },
        },
        {
          amount: 400n,
          recipient:
            '0x00d513de92c16aa42418cf7e5b60f8022dbee1b4dfd81bcf03ebee079cfb5cb5',
          origin: {
            type: 'l1tx',
            hash: '0xabf',
            status: 'Mined',
            timestamp: 3,
          },
        },
      ],
    },
    // fifth deposit
    {
      type: 'deposits',
      deposits: [
        {
          amount: 500n,
          recipient:
            '0x01e8c6c17efa3a047506c0b1610bd188aa3e3dd6c5d9227549b65428de24de78',
          origin: {
            type: 'l1tx',
            hash: '0xabe',
            status: 'Mined',
            timestamp: 4,
          },
        },
      ],
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabd',
      status: 'Confirmed',
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabeabf',
      status: 'Confirmed',
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabd',
      status: 'Mined',
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabeabf',
      status: 'Mined',
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabdabeabf',
      status: 'Confirmed',
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabdabeabf',
      status: 'Mined',
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabe',
      status: 'Confirmed',
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabe',
      status: 'Mined',
    },
    // advance clock
    {
      type: 'advance_clock',
      delta: 5000,
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabcabdabeabf',
      status: 'Confirmed',
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabcabdabeabf',
      status: 'Mined',
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabe',
      status: 'Confirmed',
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabe',
      status: 'Mined',
    },
  ];

  const initialState: OperatorState = {
    timestamp: 0,
    l1BlockNumber: 0,
    l2BlockNumber: 0,
    total: 0n,
    depositBatches: [],
    withdrawalBatches: [],
    pendingDeposits: [],
  };

  function saveState(state: OperatorState) {}

  const { clock, l1Events, l2Events, l1TxStatus, start } = mocked(events);

  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050/rpc' });

  const admin = new Account(
    provider,
    devnet.admin.address,
    devnet.admin.privateKey
    // undefined,
    // constants.TRANSACTION_VERSION.V3
  );

  // const alice = new Account(
  //   provider,
  //   devnet.alice.address,
  //   devnet.alice.privateKey,
  //   // undefined,
  //   // constants.TRANSACTION_VERSION.V3
  // );

  // const btcAddress = `0x158e01104787e42600041c770931cf1a964b9fb8b389fc9e2f0408a1650a1af`;
  const bridgeAddress =
    '0x2b553433dc1efe29adba3f9bc1b972cce032490185aba1b2572ed5c39cb5376';

  const bridge = await contractFromAddress(provider, bridgeAddress);
  bridge.connect(admin);

  const env: BridgeEnvironment = {
    DEPOSIT_BATCH_SIZE: 4,
    MAX_PENDING_DEPOSITS: 4000,
    aggregateDeposits: async (txs: L1Tx[]) => aggregateDeposits(txs),
    finalizeBatch: async (tx: L1TxStatus) => finalizeBatch(tx),
    submitDepositsToL2: async (
      hash: L1TxHash,
      deposits: Deposit[]
    ): Promise<L2Tx> =>
      submitDepositsToL2(admin, bridge, BigInt(hash), deposits),
  };

  const operator = setupOperator(
    initialState,
    env,
    clock,
    l1Events,
    l2Events,
    l1TxStatus,
    (tx: L2TxId) => l2TxStatus(provider, tx),
    applyChange,
    saveState
  );

  operator.subscribe((_) => {});

  // operator.subscribe({
  //   next: (state) => {
  //     console.log('state:');
  //     console.dir(state, { depth: null });
  //   },
  //   error: console.error,
  //   complete: () => console.log('Complete'),
  // });

  await start();
}

mockedOperator().catch(console.error);
