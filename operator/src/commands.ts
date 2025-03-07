import { closePendingWithdrawalBatch, init, withdraw } from './l2/contracts';
import assert from 'assert';
import { loadContractArtifacts, WithdrawalExpander } from 'l1';
import { PubKey } from 'scrypt-ts';
import { createDeposit } from './l1/api';
import { Config, getConfig } from './config';
import { addressToScript } from './l1/utils/contractUtil';
import { L2Address } from './state';

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
    2000n
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

async function deploy(config: Config) {
  const { btc, bridge } = await init(config.l2.admin);
  console.log(`deployed:\nbtc: ${btc.address}\nbridge: ${bridge.address} `);
}

async function commands() {
  const args = process.argv.slice(2);

  assert(args.length === 1);

  const command = args[0];

  const config = await getConfig();

  if (command === 'withdraw') {
    await withdrawFromAlice(config);
  } else if (command === 'hash') {
    printHash();
  } else if (command === 'deposit') {
    await deposit(config).catch(console.error);
  } else if (command === 'deploy') {
    await deploy(config).catch(console.error);
  } else if (command === 'closeBatch') {
    await closeBatch(config);
  } else {
    throw new Error('wrong command!');
  }
}

commands().catch(console.error);
