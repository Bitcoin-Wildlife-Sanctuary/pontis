import {
  assert,
  ByteString,
  FixedArray,
  int2ByteString,
  len,
  method,
  sha256,
  SmartContractLib,
  toByteString,
} from 'scrypt-ts'

export const MAX_INPUT = 6
export const MAX_OUTPUT = 6

export type SpentSPKs = FixedArray<ByteString, typeof MAX_OUTPUT>

export class TxUtils extends SmartContractLib {
  @method()
  static checkSpentScripts(
    spentScripts: SpentSPKs,
    hashSpentScripts: ByteString
  ): boolean {
    let mergedSPKs = toByteString('')
    for (let i = 0; i < MAX_OUTPUT; i++) {
      mergedSPKs += int2ByteString(len(spentScripts[i])) + spentScripts[i]
    }
    assert(hashSpentScripts == sha256(mergedSPKs))
    return true
  }
}
