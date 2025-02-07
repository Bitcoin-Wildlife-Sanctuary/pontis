import { UTXO } from 'scrypt-ts'
import { ChainProvider, UtxoProvider } from '../../src/lib/provider'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import { getDummyUtxo } from '../../src/lib/utils'
import { MempoolChainProvider } from '../../src/providers/mempoolChainProvider'
import { MempoolUtxoProvider } from '../../src/providers/mempoolUtxoProvider'
import { REMOTE_NETWORK } from './env'
import { RPCChainProvider } from '../../src/providers/rpcChainProvider'
import { RPCUtxoProvider } from '../../src/providers/rpcUtxoProvider'

export class TestChainProvider implements ChainProvider {
  private broadcastedTxs: Map<string, string> = new Map()

  constructor() {}
  getConfirmations(_txId: string): Promise<number> {
    return Promise.resolve(1)
  }

  async broadcast(txHex: string): Promise<string> {
    const tx = Transaction.fromHex(txHex)
    const txId = tx.getId()
    this.broadcastedTxs.set(txId, txHex)
    // console.log(`Broadcasted tx with id: ${txId}, hex: ${txHex}`)
    return txId
  }

  async getRawTransaction(txId: string): Promise<string> {
    const txHex = this.broadcastedTxs.get(txId)
    if (!txHex) {
      throw new Error(
        `Can not find the tx with id ${txId}, please broadcast it by using the TestProvider first`
      )
    }
    return txHex
  }
}

export class TestUtxoProvider implements UtxoProvider {
  constructor() {}
  markSpent(_txId: string, _vout: number): void {}
  addNewUTXO(_utxo: UTXO): void {}

  async getUtxos(
    address: string,
    _options?: { total?: number; maxCnt?: number }
  ): Promise<UTXO[]> {
    return Promise.resolve([getDummyUtxo(address)])
  }
}

export const testChainProvider = REMOTE_NETWORK ? new MempoolChainProvider(REMOTE_NETWORK) : new TestChainProvider()
export const testUtxoProvider = REMOTE_NETWORK ? new MempoolUtxoProvider(REMOTE_NETWORK) : new TestUtxoProvider()

// export const testChainProvider = REMOTE_NETWORK
//   ? new RPCChainProvider(
//       'yourrpchostandport',
//       'yourwalletname',
//       'yourusername',
//       'yourpassword'
//     )
//   : new TestChainProvider()

// export const testUtxoProvider = REMOTE_NETWORK
//   ? new RPCUtxoProvider(
//       'yourrpchostandport',
//       'yourwalletname',
//       'yourusername',
//       'yourpassword'
//     )
//   : new TestUtxoProvider()
