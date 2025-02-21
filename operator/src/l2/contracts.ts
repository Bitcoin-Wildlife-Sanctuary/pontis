import {
  Account,
  BigNumberish,
  cairo,
  Contract,
  json,
  Provider,
  RawArgs,
} from 'starknet';
import * as fs from 'fs';
import { Deposit, L2Tx, L2TxId, L2TxStatus } from '../state';
import { from, map, Observable, of } from 'rxjs';

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
    salt: "123",
    unique: true
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
  bridge: Contract
): Promise<L2Tx> {
  bridge.connect(admin);
  const { transaction_hash } = await bridge.close_withdrawal_batch();

  return {
    type: 'l2tx',
    hash: transaction_hash as any,
    status: 'PENDING',
  };
}

export function l2TxStatus(
  provider: Provider,
  tx: L2TxId
): Observable<L2TxStatus> {
  return from(provider.waitForTransaction(tx.hash)).pipe(
    map((receipt) => {
      const status = receipt.isSuccess()
        ? 'SUCCEEDED'
        : receipt.isReverted()
          ? 'REVERTED'
          : receipt.isRejected()
            ? 'REJECTED'
            : 'ERROR';
      return {
        ...tx,
        status,
        // receipt,
      };
    })
  );
}
