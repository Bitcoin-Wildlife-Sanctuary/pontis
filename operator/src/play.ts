import { Account, RpcProvider } from 'starknet';
import { contractFromAddress, init, withdraw } from './l2/contracts';
import * as devnet from './l2/devnet';
import { l2Events } from './l2/events';
import { assert } from 'console';

async function play() {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050/rpc' });

  const admin = new Account(
    provider,
    devnet.admin.address,
    devnet.admin.privateKey
  );

  const bridgeAddress =
    '0x5fe94132a5d4960ea93f163840fb1950e02c6af089fd2f808fc2f085bd51eb8';
  const bridge = await contractFromAddress(provider, bridgeAddress);
  bridge.connect(admin);
  // const { transaction_hash } = await bridge.close_withdrawal_batch();
  // const status = await provider.waitForTransaction(transaction_hash);
  // console.log(status);

  const operatorL2Events = l2Events(provider, 0, [bridgeAddress]);

  operatorL2Events.subscribe((event) => {
    console.log('event', event);
  });
}

async function withdrawFromAlice() {
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

  const btcAddress = `0x7071546bd5561c25948f3307c160409a23493608d0afdda4dbfbe597a7d45fc`;
  const bridgeAddress =
    '0xc23926ac357faf16ce9a043f547228e99a3e89510d893fa0a7b2c9351865ab';

  const bridge = await contractFromAddress(provider, bridgeAddress);
  const btc = await contractFromAddress(provider, btcAddress);

  // operator
  const recipient =
    '03bfac5406925f9fa00194aa5fd093f60775d90475dcf88c24359eddd385b398a8';

  console.log(await withdraw(provider, btc, bridge, alice, recipient, 10n));
}

const args = process.argv.slice(2);

assert(args.length === 1);

if (args[0] === 'withdraw') {
  withdrawFromAlice().catch(console.error);
} else {
  console.log('wrong command!');
}
