import * as ecurve from 'ecurve'
import { sha256 } from 'js-sha256'
import BigInteger from 'bigi'
import { emptyFixedArray } from './proof'
import {
  ByteString,
  ContractTransaction,
  int2ByteString,
  Sha256,
  toByteString,
  toHex,
  UTXO,
} from 'scrypt-ts'
import { InputsSegments, MAX_INPUT, SpentSPKs } from '../contracts/txUtil'
import { SHPreimage } from '../contracts/sigHashUtils'
import { btc } from './btc'
import {
  Transaction,
  BufferWriter,
  varSliceSize,
} from '@scrypt-inc/bitcoinjs-lib'
import * as tools from 'uint8array-tools'

const curve = ecurve.getCurveByName('secp256k1')

function hashSHA256(buff: Buffer | string) {
  return Buffer.from(sha256.create().update(buff).array())
}

export function getSigHashSchnorr(
  transaction: btc.Transaction,
  tapleafHash: Buffer,
  inputIndex = 0,
  sigHashType = 0x00
): {
  preimage: Buffer
  hash: Buffer
} {
  //const sighash = btc.Transaction.Sighash.sighash(transaction, sigHashType, inputIndex, subscript);
  const execdata = {
    annexPresent: false,
    annexInit: true,
    tapleafHash: tapleafHash,
    tapleafHashInit: true,
    ////validationWeightLeft: 110,
    ////validationWeightLeftInit: true,
    codeseparatorPos: new btc.crypto.BN(4294967295),
    codeseparatorPosInit: true,
  }

  return {
    preimage: btc.Transaction.SighashSchnorr.sighashPreimage(
      transaction,
      sigHashType,
      inputIndex,
      3,
      execdata
    ),
    hash: btc.Transaction.SighashSchnorr.sighash(
      transaction,
      sigHashType,
      inputIndex,
      3,
      execdata
    ),
  }
}

export function getE(sighash: Buffer) {
  const Gx = curve.G.affineX.toBuffer(32)

  const tagHash = hashSHA256('BIP0340/challenge')
  const tagHashMsg = Buffer.concat([Gx, Gx, sighash])
  const taggedHash = hashSHA256(Buffer.concat([tagHash, tagHash, tagHashMsg]))

  return BigInteger.fromBuffer(taggedHash).mod(curve.n)
}

export function splitSighashPreimage(preimage: Buffer) {
  return {
    tapSighash1: preimage.subarray(0, 32),
    tapSighash2: preimage.subarray(32, 64),
    epoch: preimage.subarray(64, 65),
    sighashType: preimage.subarray(65, 66),
    txVersion: preimage.subarray(66, 70),
    nLockTime: preimage.subarray(70, 74),
    hashPrevouts: preimage.subarray(74, 106),
    hashSpentAmounts: preimage.subarray(106, 138),
    hashScripts: preimage.subarray(138, 170),
    hashSequences: preimage.subarray(170, 202),
    hashOutputs: preimage.subarray(202, 234),
    spendType: preimage.subarray(234, 235),
    inputNumber: preimage.subarray(235, 239),
    tapleafHash: preimage.subarray(239, 271),
    keyVersion: preimage.subarray(271, 272),
    codeseparatorPosition: preimage.subarray(272),
  }
}

export function toSHPreimageObj(preimageParts, _e, eLastByte): SHPreimage {
  return {
    txVer: toHex(preimageParts.txVersion),
    nLockTime: toHex(preimageParts.nLockTime),
    hashPrevouts: toHex(preimageParts.hashPrevouts),
    hashSpentAmounts: toHex(preimageParts.hashSpentAmounts),
    hashSpentScripts: toHex(preimageParts.hashScripts),
    hashSequences: toHex(preimageParts.hashSequences),
    hashOutputs: toHex(preimageParts.hashOutputs),
    spendType: toHex(preimageParts.spendType),
    inputNumber: toHex(preimageParts.inputNumber),
    hashTapLeaf: toHex(preimageParts.tapleafHash),
    keyVer: toHex(preimageParts.keyVersion),
    codeSeparator: toHex(preimageParts.codeseparatorPosition),
    sigHash: toHex(preimageParts.sighashType),
    _e: toHex(_e),
    eSuffix: BigInt(eLastByte),
  }
}

export const getSpentScripts = function (tx: btc.Transaction): SpentSPKs {
  const lst = emptyFixedArray()
  for (let i = 0; i < tx.inputs.length; i++) {
    const input = tx.inputs[i]
    const spentScript = input.output.script.toBuffer().toString('hex')
    lst[i] = spentScript
  }
  return lst
}

export const getOutpointObj = function (tx: btc.Transaction, index: number) {
  const outputBuf = Buffer.alloc(4, 0)
  outputBuf.writeUInt32LE(index)
  return {
    txhash: Buffer.from(tx.id, 'hex').reverse().toString('hex'),
    outputIndex: outputBuf.toString('hex'),
  }
}

export const getOutpointString = function (tx: btc.Transaction, index: number) {
  const outputBuf = Buffer.alloc(4, 0)
  outputBuf.writeUInt32LE(index)
  return (
    Buffer.from(tx.id, 'hex').reverse().toString('hex') +
    outputBuf.toString('hex')
  )
}

export const checkDisableOpCode = function (scriptPubKey) {
  for (const chunk of scriptPubKey.chunks) {
    // New opcodes will be listed here. May use a different sigversion to modify existing opcodes.
    if (btc.Opcode.isOpSuccess(chunk.opcodenum)) {
      console.log(chunk.opcodenum, btc.Opcode.reverseMap[chunk.opcodenum])
      return true
    }
  }
  return false
}

export function checkDisableOpCodeHex(script: string): boolean {
  const scriptPubKey = btc.Script.fromHex(script)
  return checkDisableOpCode(scriptPubKey)
}

export function unlockingScriptToWitness(script: btc.Script): Buffer[] {
  return script.chunks.map((value) => {
    if (!value.buf) {
      if (value.opcodenum >= 81 && value.opcodenum <= 96) {
        const hex = int2ByteString(BigInt(value.opcodenum - 80))
        return Buffer.from(hex, 'hex')
      } else {
        return Buffer.from(toByteString(''))
      }
    }
    return value.buf
  })
}

export const contractTxToWitness = function (
  ct: ContractTransaction
): Buffer[] {
  return unlockingScriptToWitness(ct.tx.inputs[ct.atInputIndex].script)
}

export function getSHPreimage(
  tx: btc.Transaction,
  inputIndex: number,
  scriptBuffer: Buffer
): {
  SHPreimageObj: SHPreimage
  sighash: {
    preimage: Buffer
    hash: Buffer
  }
} {
  let e, eBuff, sighash
  let eLastByte = -1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    sighash = getSigHashSchnorr(tx, scriptBuffer, inputIndex)
    e = getE(sighash.hash)
    eBuff = e.toBuffer(32)
    const lastByte = eBuff[eBuff.length - 1]
    if (lastByte < 127) {
      eLastByte = lastByte
      break
    }
    tx.nLockTime += 1
  }

  if (eLastByte < 0) {
    throw new Error('No valid eLastByte!')
  }

  const _e = eBuff.slice(0, eBuff.length - 1) // e' - e without last byte
  const preimageParts = splitSighashPreimage(sighash.preimage)
  return {
    SHPreimageObj: toSHPreimageObj(preimageParts, _e, eLastByte),
    sighash: sighash,
  }
}

export function getTxCtx(
  tx: btc.Transaction,
  inputIndex: number,
  scriptBuffer: Buffer
): {
  shPreimage: SHPreimage
  spentScriptsCtx: SpentSPKs
  sighash: {
    preimage: Buffer
    hash: Buffer
  }
} {
  const { SHPreimageObj, sighash } = getSHPreimage(tx, inputIndex, scriptBuffer)
  const spentScriptsCtx = getSpentScripts(tx)
  return {
    shPreimage: SHPreimageObj,
    spentScriptsCtx: spentScriptsCtx,
    sighash,
  }
}

export function getSHPreimageMulti(
  tx: btc.Transaction,
  inputIndexList: number[],
  scriptBuffers: Buffer[]
): Array<{
  SHPreimageObj: SHPreimage
  sighash: {
    preimage: Buffer
    hash: Buffer
  }
}> {
  let eList = []
  let eBuffList = []
  let sighashList = []

  let found = false
  // eslint-disable-next-line no-constant-condition
  while (true) {
    sighashList = inputIndexList.map((inputIndex, index) =>
      getSigHashSchnorr(tx, scriptBuffers[index], inputIndex)
    )
    eList = sighashList.map((sighash) => getE(sighash.hash))
    eBuffList = eList.map((e) => e.toBuffer(32))

    if (
      eBuffList.every((eBuff) => {
        const lastByte = eBuff[eBuff.length - 1]
        return lastByte < 127
      })
    ) {
      found = true
      break
    }

    tx.nLockTime += 1
  }

  if (!found) {
    throw new Error('No valid preimage found!')
  }

  const rList = []
  for (let index = 0; index < inputIndexList.length; index++) {
    const eBuff = eBuffList[index]
    const sighash = sighashList[index]
    const _e = eBuff.slice(0, eBuff.length - 1) // e' - e without last byte
    const lastByte = eBuff[eBuff.length - 1]
    const preimageParts = splitSighashPreimage(sighash.preimage)
    rList.push({
      SHPreimageObj: toSHPreimageObj(preimageParts, _e, lastByte),
      sighash: sighash,
    })
  }
  return rList
}

export function inputToByteString(
  tx: Transaction,
  inputIndex: number
): ByteString {
  // 41 = 32(txhash) + 4(index) + 1(script) + 4(sequence)
  const len = 40 + varSliceSize(tx.ins[inputIndex].script)
  const buffer = new Uint8Array(len)
  const bufferWriter = new BufferWriter(buffer)
  bufferWriter.writeSlice(tx.ins[inputIndex].hash)
  bufferWriter.writeUInt32(tx.ins[inputIndex].index)
  bufferWriter.writeVarSlice(tx.ins[inputIndex].script)
  bufferWriter.writeUInt32(tx.ins[inputIndex].sequence)
  return tools.toHex(buffer)
}

export function inputsToSegmentByteString(tx: Transaction): InputsSegments {
  // length = nInputs[1 byte] + inputs[nInputs * 40 bytes]
  // due to MAX_STANDARD_P2WSH_STACK_ITEM_SIZE = 80, we need to split the inputs into multiple segments
  if (tx.ins.length > MAX_INPUT) {
    throw new Error('Inputs length exceeds the maximum limit')
  }
  const bytes = int2ByteString(BigInt(tx.ins.length), 1n) + tx.ins.map((_, inputIndex) => inputToByteString(tx, inputIndex)).reduce((prev, cur) => prev + cur, '');
  const segments = [];
  segments[0] = bytes.slice(0, 160)
  segments[1] = bytes.slice(160)
  return segments as InputsSegments;
}

export function outputToByteString(
  tx: Transaction,
  outputIndex: number
): ByteString {
  // 8 = 8(outputSatoshis)
  const len = 8 + varSliceSize(tx.outs[outputIndex].script)
  const buffer = new Uint8Array(len)
  const bufferWriter = new BufferWriter(buffer)
  bufferWriter.writeUInt64(tx.outs[outputIndex].value)
  bufferWriter.writeVarSlice(tx.outs[outputIndex].script)
  return tools.toHex(buffer)
}

export function outputToUtxo(tx: Transaction, outputIndex: number): UTXO {
  return {
    txId: tx.getId(),
    outputIndex: outputIndex,
    script: tools.toHex(tx.outs[outputIndex].script),
    satoshis: Number(tx.outs[outputIndex].value),
  }
}

export function splitHashFromStateOutput(
  tx: Transaction,
) {
  // state output script = 1(op return) + 1(op push 32) + 32(hash)
  // or state output script = 1(op return) + 1(op push 32) + 32(hash) + 32(hash)
  const stateScript = tx.outs[0].script;
  if (stateScript.length === ONE_STATE_OUTPUT_SCRIPT_LENGTH) {
    return [tools.toHex(stateScript.slice(2, 34)), ''] as const;
  }
  if (stateScript.length === TWO_STATE_OUTPUT_SCRIPT_LENGTH) {
    return [tools.toHex(stateScript.slice(2, 34)), tools.toHex(stateScript.slice(34, 66))] as const;
  }
  throw new Error('Invalid state output script length');
}
export const TWO_STATE_OUTPUT_SCRIPT_LENGTH = 66;
export const ONE_STATE_OUTPUT_SCRIPT_LENGTH = 34;

export function inputToPrevout(
  tx: Transaction,
  inputIndex: number
): ByteString {
  // 36 = 32(txhash) + 4(index)
  const buffer = new Uint8Array(36)
  const bufferWriter = new BufferWriter(buffer)
  bufferWriter.writeSlice(tx.ins[inputIndex].hash)
  bufferWriter.writeUInt32(tx.ins[inputIndex].index)
  return tools.toHex(buffer)
}

export function scriptWithLength(script: Buffer): Buffer {
  const len = script.length
  const buffer = new Uint8Array(len + 1)
  buffer[0] = len
  buffer.set(script, 1)
  return Buffer.from(buffer)
}

export function versionToByteString(tx: Transaction): ByteString {
  return int2ByteString(BigInt(tx.version), 4n)
}

export function locktimeToByteString(tx: Transaction): ByteString {
  return int2ByteString(BigInt(tx.locktime), 4n)
}

export function reverseTxId(txId: ByteString): ByteString {
  return tools.toHex(tools.fromHex(txId).reverse())
}

export function createEmptySha256(): Sha256 {
  return toByteString('') as Sha256
}

export function isTxHashEqual(tx: Transaction, txhash: string): boolean {
  return tools.toHex(tx.getHash()) === txhash
}
