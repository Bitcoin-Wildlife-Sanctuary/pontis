import { UTXO } from 'scrypt-ts'
import { ChainProvider, UtxoProvider } from '../../src/lib/provider'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import { getDummyUtxo } from '../../src/lib/utils'
import { MempoolChainProvider } from '../../src/providers/mempoolChainProvider'
import { MempoolUtxoProvider } from '../../src/providers/mempoolUtxoProvider'
import { REMOTE_NETWORK, rpc_config } from './env'
import { RPCChainProvider } from '../../src/providers/rpcChainProvider'
import { RPCUtxoProvider } from '../../src/providers/rpcUtxoProvider'
import { TestChainProvider, TestUtxoProvider } from '../../src/providers/testProvider'

if (REMOTE_NETWORK === 'btc-signet' && !rpc_config.host) {
  throw new Error('rpc_config must be set for btc-signet')
}
if (
  REMOTE_NETWORK === 'btc-signet' &&
  rpc_config.host &&
  rpc_config.network !== 'btc-signet'
) {
  throw new Error(
    'rpc_config.network is not consistent with env.REMOTE_NETWORK'
  )
}
if (
  REMOTE_NETWORK === 'fractal-testnet' &&
  rpc_config.host &&
  rpc_config.network !== 'fractal-testnet'
) {
  throw new Error(
    'rpc_config.network is not consistent with env.REMOTE_NETWORK'
  )
}

const rpcChainProvider = new RPCChainProvider(
  rpc_config.host,
  rpc_config.wallet,
  rpc_config.user,
  rpc_config.password
)
const rpcUtxoProvider = new RPCUtxoProvider(
  rpc_config.host,
  rpc_config.wallet,
  rpc_config.user,
  rpc_config.password
)

const mempoolChainProvider = new MempoolChainProvider(REMOTE_NETWORK)
const mempoolUtxoProvider = new MempoolUtxoProvider(REMOTE_NETWORK)

const localTestChainProvider = new TestChainProvider()
const localTestUtxoProvider = new TestUtxoProvider()

export const testChainProvider = REMOTE_NETWORK
  ? rpc_config.host
    ? rpcChainProvider
    : mempoolChainProvider
  : localTestChainProvider
export const testUtxoProvider = REMOTE_NETWORK
  ? rpc_config.host
    ? rpcUtxoProvider
    : mempoolUtxoProvider
  : localTestUtxoProvider
