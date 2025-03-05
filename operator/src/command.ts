import { Account, RpcProvider } from 'starknet';
import { contractFromAddress, init, withdraw } from './l2/contracts';
import * as devnet from './l2/devnet';
import { l2Events } from './l2/events';
import assert from 'assert';
import { loadContractArtifacts, WithdrawalExpander } from 'l1';
import { PubKey } from 'scrypt-ts';
import { L2Address } from './state';
import { createDeposit } from './l1/api';
import * as env from './l1/env';
import { toWithdrawalExpanderAddress } from './l1/transactions';

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

  const btcAddress =
    '0x3bf13a2032fa2fe8652266e93fd5acf213d6ddd05509b185ee4edf0c4000d5d';
  const bridgeAddress =
    '0x57b0b6ff4e5426725c049502bcf6362a09e6f7cca031494f39d6c569940dd43';

  const bridge = await contractFromAddress(provider, bridgeAddress);
  const btc = await contractFromAddress(provider, btcAddress);

  // operator
  const recipient = toWithdrawalExpanderAddress(
    'bc1pu9tujtamxpetkgsjyetwey8esgr2y35374ag4a9xy6j3kwwy4mzqnetae0'
  );

  console.log(await withdraw(provider, btc, bridge, alice, recipient, 509n));
}

async function deposit() {
  loadContractArtifacts();

  const l2Address: L2Address = // alice
    '0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1';

  const depositAmt = 509n;
  const operatorPubKey = await env.operatorSigner.getPublicKey();
  const deposit = await createDeposit(
    PubKey(operatorPubKey),
    env.l1Network,
    env.createUtxoProvider(),
    env.createChainProvider(),

    env.l1FeeRate,

    env.operatorSigner,
    l2Address,
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

async function deploy() {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050/rpc' });

  const admin = new Account(
    provider,
    devnet.admin.address,
    devnet.admin.privateKey
  );

  const { btc, bridge } = await init(admin);
  console.log(`deployed:\nbtc: ${btc.address}\nbridge: ${bridge.address} `);
}

const args = process.argv.slice(2);

assert(args.length === 1);

const command = args[0];

if (command === 'withdraw') {
  withdrawFromAlice().catch(console.error);
} else if (command === 'hash') {
  printHash();
} else if (command === 'deposit') {
  deposit().catch(console.error);
} else if (command === 'deploy') {
  deploy().catch(console.error);
} else {
  console.log('wrong command!');
}
