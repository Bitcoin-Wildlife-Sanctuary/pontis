import { Account, RpcProvider } from 'starknet';
import { contractFromAddress, init } from './l2/contracts';
import * as devnet from './l2/devnet';

async function deploy() {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050/rpc' });

  const admin = new Account(
    provider,
    devnet.admin.address,
    devnet.admin.privateKey
  );

  const { btc, bridge } = await init(admin);
  console.log(`deployed:\nbtc: ${btc.address}\nbridge: ${bridge.address} `);

  // const bridgeAddress =
  //   '0x2b553433dc1efe29adba3f9bc1b972cce032490185aba1b2572ed5c39cb5376';
  // const bridge = await contractFromAddress(provider, bridgeAddress);
  // bridge.connect(admin);
  // const { transaction_hash } = await bridge.close_withdrawal_batch();
  // const status = await provider.waitForTransaction(transaction_hash);
  // console.log(status);
}

deploy().catch(console.error);
