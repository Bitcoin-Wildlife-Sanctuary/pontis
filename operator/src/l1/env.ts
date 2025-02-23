import * as dotenv from 'dotenv';
import {
  MempoolChainProvider,
  MempoolUtxoProvider,
  RPCChainProvider,
  RPCUtxoProvider,
  DefaultSigner,
  SupportedNetwork,
} from 'l1';
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory } from 'ecpair';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ECPair = ECPairFactory(ecc);
bitcoinjs.initEccLib(ecc);

export const l1FeeRate = +process.env.L1_FEE_RATE! as number;
{
  // check if l1_fee_rate is set
  if (l1FeeRate <= 0) {
    throw new Error(`L1_FEE_RATE ${l1FeeRate} is not positive`);
  }
  if (isNaN(l1FeeRate)) {
    throw new Error(`L1_FEE_RATE ${l1FeeRate} is not a number`);
  }
}

export const l1Network = process.env.L1_NETWORK! as SupportedNetwork;
{
  // check if l1_network is set and supported
  if (!l1Network) {
    throw new Error('L1_NETWORK is not set');
  }
  if (
    l1Network !== 'fractal-mainnet' &&
    l1Network !== 'fractal-testnet' &&
    l1Network !== 'btc-signet'
  ) {
    throw new Error(`L1_NETWORK ${l1Network} is not supported`);
  }
}

export const rpcConfig = {
  host: process.env.RPC_HOST!,
  user: process.env.RPC_USER!,
  password: process.env.RPC_PASSWORD!,
  wallet: process.env.RPC_WALLET!,
  network: process.env.L1_RPC_NETWORK! as SupportedNetwork,
};
{
  // check if rpc_config is set and supported
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
}

export const operatorPrivateKey = process.env.L1_OPERATOR_PRIVATE_KEY!;
{
  // check if L1_OPERATOR_PRIVATE_KEY is set
  if (!operatorPrivateKey) {
    throw new Error('L1_OPERATOR_PRIVATE_KEY is not set');
  }
  try {
    ECPair.fromWIF(operatorPrivateKey);
  } catch (e) {
    throw new Error(
      `L1_OPERATOR_PRIVATE_KEY ${operatorPrivateKey} is not a valid private key`
    );
  }
}

export const operatorSigner = new DefaultSigner(
  ECPair.fromWIF(operatorPrivateKey),
  l1Network
);
export const mockUserSigner = operatorSigner;

export const useRpc = !!rpcConfig.host;

export function createUtxoProvider() {
  if (rpcConfig.host) {
    return new RPCUtxoProvider(
      rpcConfig.host,
      rpcConfig.user,
      rpcConfig.password,
      rpcConfig.wallet
    );
  }
  return new MempoolUtxoProvider(l1Network);
}

export function createChainProvider() {
  if (rpcConfig.host) {
    return new RPCChainProvider(
      rpcConfig.host,
      rpcConfig.user,
      rpcConfig.password,
      rpcConfig.wallet
    );
  }
  return new MempoolChainProvider(l1Network);
}
