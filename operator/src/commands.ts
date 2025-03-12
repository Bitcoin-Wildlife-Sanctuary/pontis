import { closePendingWithdrawalBatch, init, withdraw } from './l2/contracts';
import assert from 'assert';
import {
  BatchId,
  DepositAggregator,
  DepositAggregatorState,
  loadContractArtifacts,
  stateToBatchID,
  WithdrawalExpander,
} from 'l1';
import { int2ByteString, len, PubKey, sha256, Sha256 } from 'scrypt-ts';
import { createDeposit } from './l1/api';
import { Config, getAdmin, getConfig } from './config';
import { addressToScript, l2AddressToHex } from './l1/utils/contractUtil';
import { L2Address } from './state';
import { Account } from 'starknet';
import { utils } from 'l1';

async function withdrawFromAlice(config: Config, amount: bigint) {
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
    amount
  );

  console.log(withdrawal);
}

async function closeBatch(config: Config) {
  console.log(
    await closePendingWithdrawalBatch(config.l2.admin, config.l2.bridge)
  );
}

async function deposit(config: Config, amount: bigint) {
  loadContractArtifacts();

  const deposit = await createDeposit(
    PubKey(await config.l1.operatorSigner.getPublicKey()),
    config.l1.network,
    config.l1.createUtxoProvider(),
    config.l1.createChainProvider(),
    config.l1.feeRate,
    config.l1.operatorSigner,
    config.l2.alice.address as L2Address,
    amount
  );
  console.log('deposit', deposit);
}

function printWithdrawalHashes() {
  const leaf = WithdrawalExpander.getLeafNodeHash(
    '03bfac5406925f9fa00194aa5fd093f60775d90475dcf88c24359eddd385b398a8',
    10n
  );
  const node = WithdrawalExpander.getBranchNodeHash(10n, leaf, 10n, leaf);
  console.log('leaf hash:', leaf);
  console.log('node hash:', node);
}

function printDepositBatchId(config: Config) {
  const txId =
    'a8de6515270565a06d378922ac42278d5fd5b1ffee9fe53594f8914204167743';
  const reversedTxId = utils.reverseTxId(txId);
  const depositAddress = l2AddressToHex(config.l2.alice.address as L2Address);
  const depositAmt = 3000n;

  const deposit = stateToBatchID(
    {
      type: 'LEAF',
      level: 0n,
      depositAddress,
      depositAmt,
    },
    reversedTxId
  );

  const deposit2 = stateToBatchID(
    {
      type: 'INTERNAL',
      level: 1n,
      prevHashData0: Sha256(
        DepositAggregator.hashDepositData(depositAddress, depositAmt)
      ),
      prevHashData1: Sha256(
        DepositAggregator.hashDepositData(depositAddress, depositAmt)
      ),
    },
    reversedTxId
  );

  console.log(
    'l2Address:',
    l2AddressToHex(config.l2.alice.address as L2Address)
  );
  console.log('reversedTxId:', reversedTxId);
  console.log('deposit hash:', deposit);
  console.log('deposit2 hash:', deposit2);
}

async function deploy(admin: Account) {
  const { btc, bridge } = await init(admin);
  console.log(`deployed:\nbtc: ${btc.address}\nbridge: ${bridge.address} `);
}

async function commands() {
  const args = process.argv.slice(2);

  assert(args.length >= 1);

  const command = args[0];

  if (command === 'withdraw') {
    assert(args.length === 2);
    const amount = BigInt(args[1]);
    const config = await getConfig();
    await withdrawFromAlice(config, amount);
  } else if (command === 'printWithdrawalHashes') {
    printWithdrawalHashes();
  } else if (command === 'printDepositBatchId') {
    printDepositBatchId(await getConfig());
  } else if (command === 'deposit') {
    assert(args.length === 2);
    const amount = BigInt(args[1]);
    const config = await getConfig();
    await deposit(config, amount);
  } else if (command === 'deploy') {
    await deploy(getAdmin());
  } else if (command === 'closeBatch') {
    const config = await getConfig();
    await closeBatch(config);
  } else {
    throw new Error('wrong command!');
  }
}

commands().catch(console.error);
