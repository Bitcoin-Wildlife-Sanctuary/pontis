import { closePendingWithdrawalBatch, init, withdraw } from './l2/contracts';
import assert from 'assert';
import {
  getExpansionTree,
  loadContractArtifacts,
  withdrawalExpandedStateFromNode,
  WithdrawalExpander,
} from 'l1';
import { PubKey, Sha256 } from 'scrypt-ts';
import { createDeposit, createWithdrawal, getBridgeBalance } from './l1/api';
import { Config, getAdmin, getConfig } from './config';
import { addressToScript } from './l1/utils/contractUtil';
import { L2Address } from './state';
import { Account } from 'starknet';
import { load } from './persistence';
import { existsSync } from 'fs';
import { importAddressesIntoNode } from './l1/prepare';

async function withdrawFromAlice(config: Config) {
  /// convert the btc address to the withdrawal expander address
  const recipient = addressToScript(
    'bc1pu9tujtamxpetkgsjyetwey8esgr2y35374ag4a9xy6j3kwwy4mzqnetae0',
    config.l1.network
  );

  let withdrawal = await withdraw(
    config.l2.provider,
    config.l2.btc,
    config.l2.bridge,
    config.l2.alice,
    recipient,
    550n
  );

  console.log(withdrawal);
}

async function closeBatch(config: Config) {
  console.log(
    await closePendingWithdrawalBatch(config.l2.admin, config.l2.bridge)
  );
}

async function deposit(config: Config) {
  loadContractArtifacts();

  const depositAmt = 1000n;

  const deposit = await createDeposit(
    PubKey(await config.l1.operatorSigner.getPublicKey()),
    config.l1.network,
    config.l1.createUtxoProvider(),
    config.l1.createChainProvider(),
    config.l1.feeRate,
    config.l1.operatorSigner,
    config.l2.alice.address as L2Address,
    depositAmt
  );
  console.log('deposit', deposit);
}

function printHash() {
  const leaf = WithdrawalExpander.getLeafNodeHash(
    '03bfac5406925f9fa00194aa5fd093f60775d90475dcf88c24359eddd385b398a8',
    10n
  );
  const node = WithdrawalExpander.getBranchNodeHash(10n, leaf, 10n, leaf);
  console.log('leaf hash:', leaf);
  console.log('node hash:', node);
}

async function deploy(admin: Account) {
  const { btc, bridge } = await init(admin);
  console.log(`deployed:\nbtc: ${btc.address}\nbridge: ${bridge.address} `);
}

async function cleanup(config: Config) {
  if (!existsSync(config.STATE_PATH)) {
    return;
  }

  loadContractArtifacts();
  await importAddressesIntoNode(config);

  const state = load(config.STATE_PATH);

  const balance = await getBridgeBalance(
    config.l1.operatorSigner,
    state.bridgeState.latestTx.hash,
    config.l1.createUtxoProvider(),
    config.l1.network
  );

  console.log('cleaning up bridge balance:', balance);

  const l1Address = addressToScript(
    'bc1pu9tujtamxpetkgsjyetwey8esgr2y35374ag4a9xy6j3kwwy4mzqnetae0',
    config.l1.network
  );

  const expansionTree = getExpansionTree([
    {
      l1Address,
      amt: balance,
    },
  ]);

  console.log(expansionTree);

  const bridgeState = await createWithdrawal(
    config.l1.operatorSigner,
    config.l1.network,
    config.l1.createUtxoProvider(),
    config.l1.createChainProvider(),
    config.l1.createL1Provider(),
    config.l1.feeRate,
    state.bridgeState,
    expansionTree.hash,
    withdrawalExpandedStateFromNode(expansionTree)
  );

  console.log(bridgeState.latestTx);
}

async function commands() {
  const args = process.argv.slice(2);

  assert(args.length === 1);

  const command = args[0];

  if (command === 'withdraw') {
    const config = await getConfig();
    await withdrawFromAlice(config);
  } else if (command === 'hash') {
    printHash();
  } else if (command === 'deposit') {
    const config = await getConfig();
    await deposit(config);
  } else if (command === 'deploy') {
    await deploy(getAdmin());
  } else if (command === 'closeBatch') {
    const config = await getConfig();
    await closeBatch(config);
  } else if (command === 'cleanup') {
    const config = await getConfig();
    await cleanup(config);
  } else {
    throw new Error('wrong command!');
  }
}

commands().catch(console.error);
