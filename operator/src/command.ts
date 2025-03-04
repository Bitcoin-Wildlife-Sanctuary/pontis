import { Account, RpcProvider } from 'starknet';
import { contractFromAddress, init, withdraw } from './l2/contracts';
import * as devnet from './l2/devnet';
import { l2Events } from './l2/events';
import { assert } from 'console';
import { loadContractArtifacts, WithdrawalExpander } from 'l1';
import {
  ByteString,
  int2ByteString,
  len,
  PubKey,
  sha256,
  Sha256,
  toByteString,
} from 'scrypt-ts';
import { L2Address } from './state';
import { createDeposit } from './l1/api';
import * as env from './l1/env';
import { toWithdrawalExpanderAddress } from './l1/transactions';

async function events() {
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

// function hexToRawString(hex: string): string {
//   // Remove optional "0x" prefix.
//   if (hex.startsWith('0x') || hex.startsWith('0X')) {
//     hex = hex.slice(2);
//   }

//   let raw = '';
//   // Process every two hex characters.
//   for (let i = 0; i < hex.length; i += 2) {
//     const hexPair = hex.substr(i, 2);
//     const charCode = parseInt(hexPair, 16);
//     raw += String.fromCharCode(charCode);
//   }
//   return raw;
// }

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
    '0x4e6bd07bed93a0bf10d0ead96d9b2f227877fe3d79f46bd74324f37be237029';

  const bridge = await contractFromAddress(provider, bridgeAddress);
  const btc = await contractFromAddress(provider, btcAddress);

  // operator
  const recipient = toWithdrawalExpanderAddress(
    'bc1pu9tujtamxpetkgsjyetwey8esgr2y35374ag4a9xy6j3kwwy4mzqnetae0'
  );

  console.log(await withdraw(provider, btc, bridge, alice, recipient, 501n));
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

  // const bridgeAddress =
  //   '0x2b553433dc1efe29adba3f9bc1b972cce032490185aba1b2572ed5c39cb5376';
  // const bridge = await contractFromAddress(provider, bridgeAddress);
  // bridge.connect(admin);
  // const { transaction_hash } = await bridge.close_withdrawal_batch();
  // const status = await provider.waitForTransaction(transaction_hash);
  // console.log(status);
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
