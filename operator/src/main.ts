import { Account, RpcProvider } from 'starknet';

import { contractEvents } from './l2/events';
import { init, basicFlow } from './l2/contracts';
import * as devnet from './l2/devnet';
import {
  applyChange,
  BridgeEnvironment,
  L1TxHashAndStatus,
  OperatorState,
  TickEvent,
} from './state';
import { setupOperator } from './operator';
import { mocked, MockEvent } from './mock';
import { BehaviorSubject, finalize, tap } from 'rxjs';
import { aggregateDeposits, finalizeBatch } from './l1/l1mocks';

async function example1() {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050/rpc' });

  const admin = new Account(
    provider,
    devnet.admin.address,
    devnet.admin.privateKey
  );

  const alice = new Account(
    provider,
    devnet.alice.address,
    devnet.alice.privateKey
  );

  const bob = new Account(provider, devnet.bob.address, devnet.bob.privateKey);

  const { btc, bridge } = await init(admin);

  console.log(`BTC: ${btc.address}`);
  console.log(`Bridge: ${bridge.address}`);
  // for devnet:
  // BTC: 0x384aec22c0c63c24461abfcac606a10d178d10e36916a4789f35763c18bd78
  // Bridge: 0x5c5fb10a5b2c98c04ab60740aacf002ee8443802211db3b8558574c08365293

  const events = contractEvents(provider, bridge.address, 0);

  events.subscribe((event) => {
    console.log(event);
  });

  for (let i = 0; i < 10; i++) {
    await basicFlow(btc, bridge, admin, alice, bob);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * 2000))
    );
  }
}

async function mockedOperator() {
  const events: MockEvent[] = [
    // first deposit
    {
      type: 'deposits',
      deposits: [
        {
          amount: 100n,
          recipient: '0x123',
          origin: {
            type: 'l1tx',
            hash: '0xabc',
            status: 'Mined',
            blockNumber: 1,
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
          recipient: '0x124',
          origin: {
            type: 'l1tx',
            hash: '0xabd',
            status: 'Mined',
            blockNumber: 2,
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
          recipient: '0x125',
          origin: {
            type: 'l1tx',
            hash: '0xabe',
            status: 'Mined',
            blockNumber: 3,
            timestamp: 3,
          },
        },
        {
          amount: 400n,
          recipient: '0x126',
          origin: {
            type: 'l1tx',
            hash: '0xabf',
            status: 'Mined',
            blockNumber: 4,
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
          recipient: '0x127',
          origin: {
            type: 'l1tx',
            hash: '0xabe',
            status: 'Mined',
            blockNumber: 5,
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
      blockNumber: 0,
      timestamp: 0,
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabeabf',
      status: 'Confirmed',
      blockNumber: 0,
      timestamp: 0,
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabd',
      status: 'Mined',
      blockNumber: 0,
      timestamp: 0,
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabeabf',
      status: 'Mined',
      blockNumber: 0,
      timestamp: 0,
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabdabeabf',
      status: 'Confirmed',
      blockNumber: 0,
      timestamp: 0,
    },
    // aggregation tx status
    {
      type: 'l1tx',
      hash: '0xabcabdabeabf',
      status: 'Mined',
      blockNumber: 0,
      timestamp: 0,
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfff0xabe',
      status: 'Confirmed',
      blockNumber: 0,
      timestamp: 0,
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfff0xabe',
      status: 'Mined',
      blockNumber: 0,
      timestamp: 0,
    },
    // advance clock
    {
      type: 'advance_clock',
      delta: 5000,
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfff0xabcabdabeabf',
      status: 'Confirmed',
      blockNumber: 0,
      timestamp: 0,
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfff0xabcabdabeabf',
      status: 'Mined',
      blockNumber: 0,
      timestamp: 0,
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfff0xabe',
      status: 'Confirmed',
      blockNumber: 0,
      timestamp: 0,
    },
    // finalize tx status
    {
      type: 'l1tx',
      hash: '0xfff0xabe',
      status: 'Mined',
      blockNumber: 0,
      timestamp: 0,
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

  const {
    clock,
    l1Events,
    l2Events,
    l1TxStatus,
    l2TxStatus,
    start,
    lastTick,
    lastL1BlockNumber,
  } = mocked(events);

  const env: BridgeEnvironment = {
    DEPOSIT_BATCH_SIZE: 4,
    MAX_PENDING_DEPOSITS: 4000,
    aggregateDeposits: async (txs: L1TxHashAndStatus[]) =>
      aggregateDeposits(txs, lastL1BlockNumber.value, lastTick.value),
    finalizeBatch: async (tx: L1TxHashAndStatus) =>
      finalizeBatch(tx, lastL1BlockNumber.value, lastTick.value),
  };

  const operator = setupOperator(
    initialState,
    env,
    clock,
    l1Events,
    l2Events,
    l1TxStatus,
    l2TxStatus,
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
