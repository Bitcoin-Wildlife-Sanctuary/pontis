import { Account, Contract, json, RawArgs } from 'starknet';
import * as fs from 'fs';

async function declareAndDeploy(
  account: Account,
  name: string,
  constructorCalldata: RawArgs
) {
  const contract = json.parse(
    fs
      .readFileSync(`../l2/target/dev/pontis_${name}.contract_class.json`)
      .toString('ascii')
  );
  const casm = json.parse(
    fs
      .readFileSync(
        `../l2/target/dev/pontis_${name}.compiled_contract_class.json`
      )
      .toString('ascii')
  );

  const deployResponse = await account.declareAndDeploy({
    contract,
    casm,
    constructorCalldata,
  });

  return new Contract(
    contract.abi,
    deployResponse.deploy.contract_address,
    account
  );
}

export async function init(admin: Account) {
  const btc = await declareAndDeploy(admin, 'BTC', { owner: admin.address });
  const bridge = await declareAndDeploy(admin, 'Bridge', {
    btc_address: btc.address,
    owner: admin.address,
  });
  btc.connect(admin);
  await btc.transferOwnership(bridge.address);

  return { btc, bridge };
}

export async function basicFlow(
  btc: Contract,
  bridge: Contract,
  admin: Account,
  alice: Account,
  bob: Account
) {
  bridge.connect(admin);
  await bridge.deposit(alice.address, 1000);

  btc.connect(alice);
  await btc.transfer(bob.address, 500);

  btc.connect(bob);
  await btc.approve(bridge.address, 500);

  bridge.connect(bob);
  await bridge.withdraw(bob.address, 500);

  bridge.connect(admin);
  await bridge.close_batch();
}
