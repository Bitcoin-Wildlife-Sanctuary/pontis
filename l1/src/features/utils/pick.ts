import { UTXO } from 'scrypt-ts'
import { Bridge } from '../../contracts/bridge'
import { DepositAggregator } from '../../contracts/depositAggregator'
import { WithdrawalExpander } from '../../contracts/withdrawalExpander'
import * as path from 'path'
/**
 * Pick the UTXO containing the highest satoshis
 * @param utxos
 * @returns
 */
export function pickLargeFeeUtxo(utxos: Array<UTXO>): UTXO {
  let max = utxos[0]

  for (const utxo of utxos) {
    if (utxo.satoshis > max.satoshis) {
      max = utxo
    }
  }
  return max
}


export function loadContractArtifacts() {
  const artifactDir = path.join(__dirname, '../../../../artifacts/contracts')
  Bridge.loadArtifact(path.join(artifactDir, 'bridge.json'))
  DepositAggregator.loadArtifact(path.join(artifactDir, 'depositAggregator.json'))
  WithdrawalExpander.loadArtifact(path.join(artifactDir, 'withdrawalExpander.json'))
}