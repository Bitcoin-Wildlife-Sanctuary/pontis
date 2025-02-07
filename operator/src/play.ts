import { Account, RpcProvider } from 'starknet';
import { contractFromAddress, init } from './l2/contracts';
import * as devnet from './l2/devnet';
import { l2Events } from './l2/events';

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

play().catch(console.error);
