import { UTXO } from 'scrypt-ts'
import { ChainProvider, UtxoProvider } from '../../src/lib/provider'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import { getDummyUtxo } from '../../src/lib/utils'

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

export const testChainProvider = new TestChainProvider()
export const testUtxoProvider = new TestUtxoProvider()
