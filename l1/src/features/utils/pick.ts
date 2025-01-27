import { UTXO } from 'scrypt-ts'

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
