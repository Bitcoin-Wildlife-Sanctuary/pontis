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

export const MAX_INPUT = 3
export const MAX_OUTPUT = 6
export const MAX_INPUT_SEGMENT = 2

export type SpentSPKs = FixedArray<ByteString, typeof MAX_OUTPUT>
export type InputsSegments = FixedArray<ByteString, typeof MAX_INPUT_SEGMENT>

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

  @method()
  static mergeInputsSegments(inputsSegments: InputsSegments): ByteString {
    return inputsSegments[0] + inputsSegments[1]
  }
}
