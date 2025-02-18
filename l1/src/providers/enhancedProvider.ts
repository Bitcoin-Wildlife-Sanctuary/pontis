import { Transaction } from "@scrypt-inc/bitcoinjs-lib";
import { ChainProvider } from "../lib/provider";
import { UtxoProvider } from "../lib/provider";
import { UTXO } from "scrypt-ts";
import { outputToUtxo } from "../lib/txTools";
import { getTxId } from "../lib/utils";


/**
 * The motivation of EnhancedProvider is to build the txs in the memory first,
 * then broadcast them in one time
 * using EnhancedProvider, you don't need to handle temporary utxos and spent txs during the process of building txs.
 */
export class EnhancedProvider implements UtxoProvider, ChainProvider {
  private pendingBroadcastTxs: Transaction[] = []

  constructor(
    private readonly utxoProvider: UtxoProvider,
    private readonly chainProvider: ChainProvider,
    private readonly enhanceUtxo: boolean
  ) { }

  async getUtxos(address: string, options?: { total?: number; maxCnt?: number }): Promise<UTXO[]> {
    return this.utxoProvider.getUtxos(address, options)
  }
  
  markSpent(txId: string, vout: number) {
    this.utxoProvider.markSpent(txId, vout)
  }

  addNewUTXO(utxo: UTXO) {
    this.utxoProvider.addNewUTXO(utxo)
  }

  async broadcast(txHex: string): Promise<string> {
    const tx = Transaction.fromHex(txHex)
    this.pendingBroadcastTxs.push(tx)

    if (this.enhanceUtxo) {
      tx.ins.forEach((input) => {
        this.markSpent(getTxId(input), input.index)
      })
      tx.outs.forEach((_, outputIndex) => {
        const utxo = outputToUtxo(tx, outputIndex)
        this.addNewUTXO(utxo)
      })
    }

    return tx.getId()
  }

  async getRawTransaction(txId: string): Promise<string> {
    const findPendingTx = this.pendingBroadcastTxs.find(tx => tx.getId() === txId)
    if (findPendingTx) {
      return findPendingTx.toHex()
    }
    return this.chainProvider.getRawTransaction(txId)
  }

  async getConfirmations(txId: string): Promise<number> {
    const findPendingTx = this.pendingBroadcastTxs.find(tx => tx.getId() === txId)
    if (findPendingTx) {
      return 0
    }
    return this.chainProvider.getConfirmations(txId)
  }

  async finalBroadcast(): Promise<{
    broadcastedTxids: string[],
    failedBroadcastTxids: string[],
    failedBroadcastTxError: Error | null
  }> {
    let broadcastedTxids: string[] = []
    let failedBroadcastTxids: string[] = []
    let failedBroadcastTxError: Error | null = null
    for (let i = 0; i < this.pendingBroadcastTxs.length; i++) {
      const tx = this.pendingBroadcastTxs[i]
      try {
        await this.chainProvider.broadcast(tx.toHex())
        broadcastedTxids.push(tx.getId())
      } catch (error) {
        failedBroadcastTxids = this.pendingBroadcastTxs.slice(i).map(v => v.getId())
        failedBroadcastTxError = error as Error
        break
      }
    }
    this.pendingBroadcastTxs = []
    return {
      broadcastedTxids,
      failedBroadcastTxids,
      failedBroadcastTxError
    }
  }
}

