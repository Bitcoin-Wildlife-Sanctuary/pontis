import { Account, RpcProvider } from 'starknet';

import { contractEvents } from './l2/events';
import { init, basicFlow } from './l2/contracts';
import * as devnet from './l2/devnet';
import { OperatorState } from './state';
import { setupOperator } from './operator';
import { mocked, MockEvent } from './mock';
import { tap } from 'rxjs';

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
    {
      delay: 0,
      event: {
        type: 'deposits',
        blockNumber: 1,
        deposits: [
          {
            amount: 100n,
            recipient: '0x123',
            origin: {
              type: 'l1tx',
              hash: '0xabc',
              status: 'Mined',
              blockNumber: 1,
              timestamp: 1000,
            },
          },
        ],
      },
    },
    {
      delay: 100,
      event: {
        type: 'deposits',
        blockNumber: 2,
        deposits: [
          {
            amount: 200n,
            recipient: '0x124',
            origin: {
              type: 'l1tx',
              hash: '0xabd',
              status: 'Mined',
              blockNumber: 2,
              timestamp: 2000,
            },
          },
        ],
      },
    },
    {
      delay: 100,
      event: {
        type: 'deposits',
        blockNumber: 3,
        deposits: [
          {
            amount: 300n,
            recipient: '0x125',
            origin: {
              type: 'l1tx',
              hash: '0xabd',
              status: 'Mined',
              blockNumber: 3,
              timestamp: 3000,
            },
          },
        ],
      },
    },
    {
      delay: 100,
      event: {
        type: 'deposits',
        blockNumber: 4,
        deposits: [
          {
            amount: 400n,
            recipient: '0x126',
            origin: {
              type: 'l1tx',
              hash: '0xabe',
              status: 'Mined',
              blockNumber: 3,
              timestamp: 4000,
            },
          },
        ],
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

  const { l1Events, l2Events, l1TxStatus, l2TxStatus, start } = mocked(events);

  const operator = setupOperator(
    initialState,
    l1Events,
    l2Events,
    l1TxStatus,
    l2TxStatus,
    saveState
  );

  //.pipe(tap((state) => console.dir(state, { depth: null })));

  operator.subscribe({
    next: (state) => {
      console.log('State:');
      console.dir(state, { depth: null });
    },
    error: console.error,
    complete: () => console.log('Complete'),
  });

  await start();
}

mockedOperator().catch(console.error);
