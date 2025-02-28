import {
  Account,
  cairo,
  CallData,
  Contract,
  GetTransactionReceiptResponse,
  json,
  Provider,
  RawArgs,
} from 'starknet';
import * as fs from 'fs';
import { Deposit, L2Tx, L2TxId, L2TxStatus } from '../state';
import { from, map, Observable } from 'rxjs';

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
    salt: '123',
    unique: true,
  });

  return new Contract(
    contract.abi,
    deployResponse.deploy.contract_address,
    account
  );
}

export async function contractFromAddress(provider: Provider, address: string) {
  const { abi } = await provider.getClassAt(address);
  if (abi === undefined) {
    throw new Error('no abi.');
  }
  return new Contract(abi, address, provider);
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

export function toDigest(x: bigint): { value: bigint[] } {
  const value = new Array<bigint>(8);

  for (let i = 0; i < 8; i++) {
    const shift = 32n * BigInt(i);
    value[i] = (x >> shift) & 0xffffffffn;
  }

  return { value };
}

export function fromDigest(value: bigint[]): bigint {
  let result = 0n;
  for (let i = 7; i >= 0; i--) {
    result = (result << 32n) + value[i];
  }
  return result;
}

export async function submitDepositsToL2(
  admin: Account,
  bridge: Contract,
  hash: bigint,
  deposits: Deposit[]
): Promise<L2Tx> {
  const call = bridge.populate('deposit', [
    toDigest(hash),
    deposits.map(({ recipient, amount }) => ({
      recipient: BigInt(recipient),
      amount,
    })),
  ]);
  // we need to remove lenght due to the faulty handling of
  // fixed array parameters in starknetjs
  call.calldata = (call.calldata as any).slice(1);

  const { transaction_hash } = await admin.execute(call);

  return {
    type: 'l2tx',
    hash: transaction_hash as any,
    status: 'PENDING',
  };
}

export async function closePendingWithdrawalBatch(
  admin: Account,
  bridge: Contract,
  id: bigint
): Promise<L2Tx> {
  bridge.connect(admin);
  const { transaction_hash } = await bridge.close_withdrawal_batch(id);

  return {
    type: 'l2tx',
    hash: transaction_hash as any,
    status: 'PENDING',
  };
}

function receipToStatus(receipt: GetTransactionReceiptResponse) {
  return receipt.isSuccess()
    ? 'SUCCEEDED'
    : receipt.isReverted()
      ? 'REVERTED'
      : receipt.isRejected()
        ? 'REJECTED'
        : 'ERROR';
}

export function l2TxStatus(
  provider: Provider,
  tx: L2TxId
): Observable<L2TxStatus> {
  return from(provider.waitForTransaction(tx.hash)).pipe(
    map((receipt) => {
      return {
        ...tx,
        status: receipToStatus(receipt),
      };
    })
  );
}

type WordSpan = {
  input: bigint[];
  last_input_word: bigint;
  last_input_num_bytes: bigint;
};

function hexToWordSpan(hex: string): WordSpan {
  if (hex.startsWith('0x') || hex.startsWith('0X')) {
    hex = hex.slice(2);
  }

  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have an even number of characters.');
  }

  const input: bigint[] = [];
  const completeLength = hex.length - (hex.length % 8);
  for (let i = 0; i < completeLength; i += 8) {
    const chunk = hex.substring(i, i + 8);
    input.push(BigInt(`0x${chunk}`));
  }

  const remainderLength = hex.length % 8;
  if (remainderLength > 0) {
    const remainderHex = hex.slice(completeLength);
    const last_input_num_bytes = BigInt(remainderHex.length / 2);
    const last_input_word = BigInt(`0x${remainderHex}`);
    return {
      input,
      last_input_word,
      last_input_num_bytes,
    };
  } else {
    return { input, last_input_word: 0n, last_input_num_bytes: 0n };
  }
}

export function wordSpanToHex(word: WordSpan): string {
  let hex = '';

  for (const chunk of word.input) {
    hex += chunk.toString(16).padStart(8, '0');
  }

  if (word.last_input_num_bytes > 0n) {
    const expectedLength = word.last_input_num_bytes * 2n;
    hex += word.last_input_word
      .toString(16)
      .padStart(Number(expectedLength), '0');
  }
  return hex;
}

export async function withdraw(
  provider: Provider,
  btc: Contract,
  bridge: Contract,
  sender: Account,
  recipient: string, // as hex
  amount: bigint
): Promise<L2Tx> {
  const { transaction_hash } = await sender.execute([
    {
      contractAddress: btc.address,
      entrypoint: 'approve',
      calldata: CallData.compile({
        spender: bridge.address,
        amount: cairo.uint256(amount),
      }),
    },
    {
      contractAddress: bridge.address,
      entrypoint: 'withdraw',
      calldata: CallData.compile({
        recipient: hexToWordSpan(recipient),
        amount,
      }),
    },
  ]);

  return {
    type: 'l2tx',
    hash: transaction_hash as any,
    status: receipToStatus(await provider.waitForTransaction(transaction_hash)),
  };
}
