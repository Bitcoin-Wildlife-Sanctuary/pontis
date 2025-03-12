import { closePendingWithdrawalBatch, init, withdraw } from './l2/contracts';
import assert from 'assert';
import {
  BatchId,
  DepositAggregator,
  DepositAggregatorState,
  loadContractArtifacts,
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

// export function reverseTxId(txId: ByteString): ByteString {
//   return tools.toHex(tools.fromHex(txId).reverse())
// }

export function stateToBatchID(
  state: DepositAggregatorState,
  prevTxid: string
): BatchId {
  const hash =
    state.type === 'LEAF'
      ? DepositAggregator.hashDepositData(
          state.depositAddress,
          state.depositAmt
        )
      : DepositAggregator.hashAggregatorData(
          state.level,
          state.prevHashData0,
          state.prevHashData1
        );

  if (state.type === 'LEAF') {
    console.log('state.depositAddress', state.depositAddress);
    console.log('state.depositAmt', state.depositAmt);
    console.log(
      'DepositAggregator.hashDepositData',
      DepositAggregator.hashDepositData(state.depositAddress, state.depositAmt)
    );
  } else {
    console.log('state.level', state.level);
    console.log('state.prevHashData0', state.prevHashData0);
    console.log('state.prevHashData1', state.prevHashData1);
    console.log(
      'hash input: ',
      int2ByteString(state.level) + state.prevHashData0 + state.prevHashData1
    );
    console.log(
      'DepositAggregator.hashAggregatorData',
      DepositAggregator.hashAggregatorData(
        state.level,
        state.prevHashData0,
        state.prevHashData1
      )
    );
  }

  /// add prevTxid to the hash to make it unique

  console.log('prevTxid:', prevTxid);
  console.log('sha256 input:', prevTxid + hash);
  console.log('sha256', sha256(prevTxid + hash));

  return sha256(prevTxid + hash);
}

function printDepositBatchId(config: Config) {
  const txId =
    'a8de6515270565a06d378922ac42278d5fd5b1ffee9fe53594f8914204167743';
  // const txId = 'bc0b9a4a67e2bea27991d6401dcb5ecaf7262b2c21f3e767367f6fa9dae65dbf';
  const reversedTxId = utils.reverseTxId(txId);
  const depositAddress = l2AddressToHex(config.l2.alice.address as L2Address);
  const depositAmt = 3000n;

  // const deposit = stateToBatchID(
  //   {
  //     type: 'LEAF',
  //     level: 0n,
  //     depositAddress,
  //     depositAmt,
  //   },
  //   reversedTxId
  // );

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
  // console.log('deposit hash:', deposit);
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
