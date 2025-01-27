import { UTXO } from 'scrypt-ts'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import { getTxId } from './utils'
import { DepositAggregatorState } from '../covenants/depositAggregatorCovenant'
import { BridgeState } from '../covenants/bridgeCovenant'
import { WithdrawalExpanderState } from '../covenants/withdrawalExpanderCovenant'


export interface DepositAggregatorUtxo  {
  state: DepositAggregatorState
  utxo: UTXO
}

export interface WithdrawalExpanderUtxo {
  state: WithdrawalExpanderState
  utxo: UTXO
}   

export interface BridgeUtxo {
  state: BridgeState
  utxo: UTXO
}

/**
 * a Provider used to query UTXO related to the address
 */
export interface UtxoProvider {
  getUtxos(
    address: string,
    options?: { total?: number; maxCnt?: number }
  ): Promise<UTXO[]>
  markSpent(txId: string, vout: number): void
  addNewUTXO(utxo: UTXO): void
}

type TxId = string

/**
 * a provider for interacting with the blockchain
 */
export interface ChainProvider {
  broadcast(txHex: string): Promise<TxId>
  getRawTransaction(txId: TxId): Promise<string>

  getConfirmations(txId: TxId): Promise<number>
}

export function markSpent(utxoProvider: UtxoProvider, tx: Transaction) {
  for (let i = 0; i < tx.ins.length; i++) {
    const input = tx.ins[i]
    utxoProvider.markSpent(getTxId(input), input.index)
  }
}
