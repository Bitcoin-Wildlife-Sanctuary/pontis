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
  DepositBatch,
  L1Tx,
  L1TxHash,
  L1TxStatus,
  L2Tx,
  L2TxId,
  L2TxStatus,
  OperatorState,
  Withdrawal,
} from './state';
import { setupOperator } from './operator';
import { mocked, MockEvent } from './mock';
import { aggregateDeposits, finalizeBatch } from './l1/l1mocks';
import { filter, merge } from 'rxjs';
import { close } from 'fs';

async function mockedOperator() {
  const events: MockEvent[] = [
    // first deposit
    {
      type: 'deposits',
      deposits: [
        {
          amount: 100n,
          // alice
          recipient:
            '0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1',
          origin: {
            type: 'l1tx',
            hash: '0xabc',
            status: 'MINED',
            blockNumber: 1,
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
          // bob
          recipient:
            '0x049dfb8ce986e21d354ac93ea65e6a11f639c1934ea253e5ff14ca62eca0f38e',
          origin: {
            type: 'l1tx',
            hash: '0xabd',
            status: 'MINED',
            blockNumber: 2,
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
            status: 'MINED',
            blockNumber: 3,
          },
        },
        {
          amount: 400n,
          recipient:
            '0x00d513de92c16aa42418cf7e5b60f8022dbee1b4dfd81bcf03ebee079cfb5cb5',
          origin: {
            type: 'l1tx',
            hash: '0xabf',
            status: 'MINED',
            blockNumber: 3,
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
            status: 'MINED',
            blockNumber: 4,
          },
        },
      ],
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabd',
      status: 'UNCONFIRMED',
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabeabf',
      status: 'UNCONFIRMED',
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabd',
      status: 'MINED',
      blockNumber: 1
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabeabf',
      status: 'MINED',
      blockNumber: 1
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabdabeabf',
      status: 'UNCONFIRMED',
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabdabeabf',
      status: 'MINED',
      blockNumber: 1
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabe',
      status: 'UNCONFIRMED',
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabe',
      status: 'MINED',
      blockNumber: 1
    },
    // advance clock
    {
      type: 'advanceL1BlockNumber',
      delta: 50,
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabcabdabeabf',
      status: 'UNCONFIRMED',
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabcabdabeabf',
      status: 'MINED',
      blockNumber: 50
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabe',
      status: 'UNCONFIRMED',
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfffabe',
      status: 'MINED',
      blockNumber: 50
    },
    {
      type: 'function_call',
      call: async () => {
        const alice = new Account(
          provider,
          devnet.alice.address,
          devnet.alice.privateKey
          // undefined,
          // constants.TRANSACTION_VERSION.V3
        );
        btc.connect(alice);
        const r1 = await btc.approve(bridge.address, 100);
        await provider.waitForTransaction(r1.transaction_hash);

        bridge.connect(alice);
        const r2 = await bridge.withdraw(alice.address, 100);
        await provider.waitForTransaction(r2.transaction_hash);
      },
    },
    {
      type: 'function_call',
      call: async () => {
        for (const _ of [1, 2, 3]) {
          try {
            const response = await fetch('http://127.0.0.1:5050/create_block', {
              method: 'POST',
            });
            if (!response.ok) {
              throw new Error(`Request failed with status ${response.status}`);
            }
          } catch (error) {
            console.error('Error creating block:', error);
          }
        }
      },
    },
  ];

  const initialState: OperatorState = {
    l1BlockNumber: 0,
    l2BlockNumber: 0,
    total: 0n,
    depositBatches: [],
    withdrawalBatches: [],
    pendingDeposits: [],
  };

  function saveState(state: OperatorState) {}

  const { clock, l1Events, l1TxStatus, start } = mocked(events);

  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050/rpc' });

  const admin = new Account(
    provider,
    devnet.admin.address,
    devnet.admin.privateKey
    // undefined,
    // constants.TRANSACTION_VERSION.V3
  );

  const btcAddress = `0x179d86ff28c3bdfd989d0dcd54b076dabe9941db110417f9d2ac00b2e04b509`;
  const bridgeAddress =
    '0x1d8f97b57e8886406b016915049a263c5aa627919beed25f7ca4b0cf14c7fea';

  const bridge = await contractFromAddress(provider, bridgeAddress);
  const btc = await contractFromAddress(provider, btcAddress);
  bridge.connect(admin);

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
    ): Promise<L2Tx> => submitDepositsToL2(admin, bridge, BigInt(hash), deposits),
    closePendingWithdrawalBatch: async (): Promise<L2Tx> => closePendingWithdrawalBatch(admin, bridge),
    createWithdrawalExpander: function (withdrawals: Withdrawal[], hash: string): Promise<L1Tx> {
      throw new Error('Function not implemented.');
    },
    expandWithdrawals: function (withdrawals: Withdrawal[], hash: string, expansionTxs: L1Tx[]): Promise<L1Tx[]> {
      throw new Error('Function not implemented.');
    }
  };

  const operatorL2Events = l2Events(provider, initialState.l2BlockNumber, [
    bridgeAddress,
  ]);

  const operator = setupOperator(
    initialState,
    env,
    merge(clock, l2BlockNumber(provider)),
    l1Events,
    operatorL2Events,
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
