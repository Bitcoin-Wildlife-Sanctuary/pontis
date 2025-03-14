import {
  ByteString,
  PubKey,
  Sig,
  SmartContractLib,
  assert,
  int2ByteString,
  method,
  prop,
  sha256,
  toByteString,
} from 'scrypt-ts'

export const TAG_HASH =
  '7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c' // sha256("BIP0340/challenge")
export const TAPSIGHASH =
  'f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a031' // sha256("TapSighash")
export const Gx =
  '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
export const PREIMAGE_SIGHASH = '00' // SIGHASH_ALL
export const PREIMAGE_EPOCH = '00'

/**
 * The sighash preimage.
 * ref: https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki#common-signature-message
 */
export type SHPreimage = {
  /**
   * (4): the nVersion of the transaction.
   */
  txVer: ByteString
  /**
   * (4): the nLockTime of the transaction.
   */
  nLockTime: ByteString
  /**
   * (32): the SHA256 of the serialization of all input outpoints.
   */
  hashPrevouts: ByteString
  /**
   * (32): the SHA256 of the serialization of all input amounts.
   */
  hashSpentAmounts: ByteString
  /**
   * (32): the SHA256 of all spent outputs' scriptPubKeys, serialized as script inside CTxOut.
   */
  hashSpentScripts: ByteString
  /**
   * (32): the SHA256 of the serialization of all input nSequence.
   */
  hashSequences: ByteString
  /**
   * (32): the SHA256 of the serialization of all outputs in CTxOut format.
   */
  hashOutputs: ByteString
  /**
   * (1): equal to (ext_flag * 2) + annex_present, where annex_present is 0 if no annex is present, or 1 otherwise (the original witness stack has two or more witness elements, and the first byte of the last element is 0x50)
   */
  spendType: ByteString
  /**
   * (4): index of this input in the transaction input vector. Index of the first input is 0.
   */
  inputNumber: ByteString
  /**
   * (32): the tap leaf hash of the input
   * ref: https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki#common-signature-message-extension | BIP342
   */
  hashTapLeaf: ByteString
  /**
   * (1): the key version.
   * a constant value 0x00 representing the current version of public keys in the tapscript signature opcode execution.
   * ref: https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki#common-signature-message-extension
   */
  keyVer: ByteString
  /**
   * (4): the opcode position of the last executed OP_CODESEPARATOR before the currently executed signature opcode, with the value in little endian (or 0xffffffff if none executed). The first opcode in a script has a position of 0. A multi-byte push opcode is counted as one opcode, regardless of the size of data being pushed. Opcodes in parsed but unexecuted branches count towards this value as well.
   * ref: https://github.com/bitcoin/bips/blob/master/bip-0342.mediawiki#common-signature-message-extension
   */
  codeSeparator: ByteString

  /**
   * (1): the sighash type.
   */
  sigHash: ByteString


  /**
   * data for sign in contract
   * ref: https://scryptplatform.medium.com/trustless-ordinal-sales-using-op-cat-enabled-covenants-on-bitcoin-0318052f02b2
   */
  _e: ByteString // e without last byte
  /**
   * data for sign in contract
   * ref: https://scryptplatform.medium.com/trustless-ordinal-sales-using-op-cat-enabled-covenants-on-bitcoin-0318052f02b2
   */
  eSuffix: bigint // last byte of e
}

export class SigHashUtils extends SmartContractLib {
  // Data for checking sighash preimage:
  @prop()
  static readonly Gx: PubKey = PubKey(
    toByteString(
      '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
    )
  )
  @prop()
  static readonly ePreimagePrefix: ByteString = toByteString(
    '7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c7bb52d7a9fef58323eb1bf7a407db382d2f3f2d81bb1224f49fe518f6d48d37c79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f8179879be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  ) // TAG_HASH + TAG_HASH + Gx + Gx
  @prop()
  static readonly preimagePrefix: ByteString = toByteString(
    'f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a031f40a48df4b2a70c8b4924bf2654661ed3d95fd66a313eb87237597c628e4a0310000'
  ) // TAPSIGHASH + TAPSIGHASH + PREIMAGE_SIGHASH + PREIMAGE_EPOCH

  @method()
  static checkSHPreimage(shPreimage: SHPreimage): Sig {
    const sigHash = sha256(
      SigHashUtils.preimagePrefix +
        shPreimage.txVer +
        shPreimage.nLockTime +
        shPreimage.hashPrevouts +
        shPreimage.hashSpentAmounts +
        shPreimage.hashSpentScripts +
        shPreimage.hashSequences +
        shPreimage.hashOutputs +
        shPreimage.spendType +
        shPreimage.inputNumber +
        shPreimage.hashTapLeaf +
        shPreimage.keyVer +
        shPreimage.codeSeparator
    )

    const e = sha256(SigHashUtils.ePreimagePrefix + sigHash)
    assert(shPreimage.eSuffix < 127n, 'invalid value of _e')
    const eLastByte =
      shPreimage.eSuffix == 0n
        ? toByteString('00')
        : int2ByteString(shPreimage.eSuffix)
    assert(e == shPreimage._e + eLastByte, 'invalid value of _e')
    const s =
      SigHashUtils.Gx + shPreimage._e + int2ByteString(shPreimage.eSuffix + 1n)
    //assert(this.checkSig(Sig(s), SigHashUtils.Gx)) TODO (currently done outside)
    return Sig(s)
  }
}
