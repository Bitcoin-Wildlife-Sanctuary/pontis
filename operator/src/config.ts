import * as dotenv from 'dotenv';
import {
  MempoolChainProvider,
  MempoolUtxoProvider,
  RPCChainProvider,
  RPCUtxoProvider,
  DefaultSigner,
  SupportedNetwork,
  EnhancedProvider,
  ChainProvider,
} from 'l1';
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory } from 'ecpair';
import * as path from 'path';
import { contractFromAddress } from './l2/contracts';
import { Account, constants, RpcProvider } from 'starknet';
import assert from 'assert';
import { createL1Provider } from './l1/deps/l1Provider';

dotenv.config({ path: path.join(__dirname, '../.env') });

const ECPair = ECPairFactory(ecc);
bitcoinjs.initEccLib(ecc);

function createUtxoProvider(
  l1Network: SupportedNetwork,
  rpcConfig: {
    host?: string;
    user?: string;
    password?: string;
    wallet?: string;
  }
) {
  if (rpcConfig.host) {
    return new RPCUtxoProvider(
      rpcConfig.host,
      rpcConfig.user!,
      rpcConfig.password!,
      rpcConfig.wallet!
    );
  }
  return new MempoolUtxoProvider(l1Network);
}

function createChainProvider(
  l1Network: SupportedNetwork,
  rpcConfig: {
    host?: string;
    user?: string;
    password?: string;
    wallet?: string;
  }
): ChainProvider {
  if (rpcConfig.host) {
    return new RPCChainProvider(
      rpcConfig.host,
      rpcConfig.user!,
      rpcConfig.password!,
      rpcConfig.wallet!
    );
  }
  return new MempoolChainProvider(l1Network);
}

function getInt(property: string): number {
  const v = process.env[property];
  assert(v, `${property} is not set`);

  const r = parseInt(v);
  if (isNaN(r)) {
    throw new Error(`${property} ${v} is not a number`);
  }

  return r;
}

export async function getConfig() {
  const l1FeeRate = getInt('L1_FEE_RATE');
  if (l1FeeRate <= 0) {
    throw new Error(`L1_FEE_RATE ${l1FeeRate} is not positive`);
  }

  assert(process.env.L1_NETWORK, 'L1_NETWORK is not set');
  const l1Network = process.env.L1_NETWORK as SupportedNetwork;
  if (
    l1Network !== 'fractal-mainnet' &&
    l1Network !== 'fractal-testnet' &&
    l1Network !== 'btc-signet'
  ) {
    throw new Error(`L1_NETWORK ${l1Network} is not supported`);
  }

  const rpcConfig = {
    host: process.env.RPC_HOST,
    user: process.env.RPC_USER,
    password: process.env.RPC_PASSWORD,
    wallet: process.env.RPC_WALLET,
    network: process.env.L1_RPC_NETWORK as SupportedNetwork,
  };
  if (rpcConfig.host) {
    if (
      !rpcConfig.user ||
      !rpcConfig.password ||
      !rpcConfig.wallet ||
      !rpcConfig.network
    ) {
      throw new Error(
        'RPC_USER, RPC_PASSWORD, RPC_WALLET, and L1_RPC_NETWORK must be set if RPC_HOST is set'
      );
    }
    if (rpcConfig.network !== l1Network) {
      throw new Error(
        `RPC_NETWORK ${rpcConfig.network} does not match L1_NETWORK ${l1Network}`
      );
    }
  }
  const useRpc = !!rpcConfig.host;

  assert(
    process.env.L1_OPERATOR_PRIVATE_KEY,
    'L1_OPERATOR_PRIVATE_KEY is not set'
  );
  const operatorPrivateKey = process.env.L1_OPERATOR_PRIVATE_KEY!;
  try {
    ECPair.fromWIF(operatorPrivateKey);
  } catch (e) {
    throw new Error(
      `L1_OPERATOR_PRIVATE_KEY ${operatorPrivateKey} is not a valid private key`
    );
  }
  const operatorSigner = new DefaultSigner(
    ECPair.fromWIF(operatorPrivateKey),
    l1Network
  );
  const mockUserSigner = operatorSigner;

  assert(process.env.L2_NODE_URL, 'L2_NODE_URL is not set');
  const provider = new RpcProvider({ nodeUrl: process.env.L2_NODE_URL! });

  assert(process.env.L2_BRIDGE_ADDRESS, 'L2_BRIDGE_ADDRESS is not set');
  const bridge = await contractFromAddress(
    provider,
    process.env.L2_BRIDGE_ADDRESS!
  );

  assert(process.env.L2_BTC_ADDRESS, 'L2_BTC_ADDRESS is not set');
  const btc = await contractFromAddress(provider, process.env.L2_BTC_ADDRESS!);

  const admin = getAdmin();

  assert(process.env.L2_ALICE_ADDRESS, 'L2_ALICE_ADDRESS is not set');
  assert(process.env.L2_ALICE_PRIVATE_KEY, 'L2_ALICE_PRIVATE_KEY is not set');
  const alice = new Account(
    provider,
    process.env.L2_ALICE_ADDRESS!,
    process.env.L2_ALICE_PRIVATE_KEY!,
    undefined,
    constants.TRANSACTION_VERSION.V3
  );

  assert(process.env.L2_BOB_ADDRESS, 'L2_BOB_ADDRESS is not set');
  assert(process.env.L2_BOB_PRIVATE_KEY, 'L2_BOB_PRIVATE_KEY is not set');
  const bob = new Account(
    provider,
    process.env.L2_BOB_ADDRESS!,
    process.env.L2_BOB_PRIVATE_KEY!,
    undefined,
    constants.TRANSACTION_VERSION.V3
  );

  assert(process.env.STATE_PATH, 'STATE_PATH is not set');
  const STATE_PATH = process.env.STATE_PATH!;

  const DEPOSIT_BATCH_SIZE = getInt('DEPOSIT_BATCH_SIZE');
  const MAX_DEPOSIT_BLOCK_AGE = getInt('MAX_DEPOSIT_BLOCK_AGE');
  const MAX_WITHDRAWAL_BLOCK_AGE = getInt('MAX_WITHDRAWAL_BLOCK_AGE');
  const MAX_WITHDRAWAL_BATCH_SIZE = getInt('MAX_WITHDRAWAL_BATCH_SIZE')!;

  return {
    STATE_PATH,
    DEPOSIT_BATCH_SIZE,
    MAX_DEPOSIT_BLOCK_AGE,
    MAX_WITHDRAWAL_BLOCK_AGE,
    MAX_WITHDRAWAL_BATCH_SIZE,
    l1: {
      feeRate: l1FeeRate,
      network: l1Network,
      rpcConfig,
      operatorPrivateKey,
      operatorSigner,
      mockUserSigner,
      useRpc,
      createUtxoProvider: () => createUtxoProvider(l1Network, rpcConfig),
      createChainProvider: () => createChainProvider(l1Network, rpcConfig),
      createEnhancedProvider: () =>
        new EnhancedProvider(
          createUtxoProvider(l1Network, rpcConfig),
          createChainProvider(l1Network, rpcConfig),
          true
        ),
      createL1Provider: () =>
        createL1Provider(useRpc, rpcConfig as any, l1Network),
    },
    l2: {
      provider,
      bridge,
      btc,
      admin,
      alice,
      bob,
    },
  };
}

export function getAdmin() {
  assert(process.env.L2_NODE_URL, 'L2_NODE_URL is not set');
  const provider = new RpcProvider({ nodeUrl: process.env.L2_NODE_URL! });

  assert(process.env.L2_ADMIN_ADDRESS, 'L2_ADMIN_ADDRESS is not set');
  assert(process.env.L2_ADMIN_PRIVATE_KEY, 'L2_ADMIN_PRIVATE_KEY is not set');

  const admin = new Account(
    provider,
    process.env.L2_ADMIN_ADDRESS!,
    process.env.L2_ADMIN_PRIVATE_KEY!,
    undefined,
    constants.TRANSACTION_VERSION.V3
  );

  return admin;
}

export type Config = Awaited<ReturnType<typeof getConfig>>;
