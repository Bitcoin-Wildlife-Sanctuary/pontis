import { Account, RpcProvider } from 'starknet';

import { contractEvents } from './l2/events';
import { init, basicFlow } from './l2/contracts';
import * as devnet from './l2/devnet';

async function run() {
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

    const events = contractEvents(
        provider,
        bridge.address,
        0
    );

    events.subscribe((event) => {
        console.log(event);
    });

    for(let i = 0; i < 10; i++) {
        await basicFlow(btc, bridge, admin, alice, bob);
        await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 2000)));
    }
}

run().catch(console.error);
