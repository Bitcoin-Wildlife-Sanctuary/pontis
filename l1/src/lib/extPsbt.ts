import { Psbt, PsbtOptsOptional, Transaction } from '@scrypt-inc/bitcoinjs-lib'
import { checkForInput, PsbtInput } from 'bip174'
import { MAX_INPUT, MAX_OUTPUT, SpentSPKs } from '../contracts/txUtil'
import { PSBTOptions, ToSignInput } from './signer'
import { Covenant } from './covenant'
import { btc, LEAF_VERSION_TAPSCRIPT } from './btc'
import { TapLeafSmartContract } from './tapLeafContract'
import {
  ByteString,
  DummyProvider,
  sha256,
  Sig,
  TestWallet,
  toByteString,
  UTXO,
} from 'scrypt-ts'
import {
  bigintToByteString,
  getDummyUtxo,
  isFinalized,
  isTaprootInput,
  script2Addr,
  toBtcTransaction,
  toXOnly,
  validteSupportedAddress,
  witnessStackToScriptWitness,
  xPubkeyToAddr,
} from './utils'
import {
  contractTxToWitness,
  splitSighashPreimage,
  getE,
  getSigHashSchnorr,
  toSHPreimageObj,
  getSpentScripts,
} from './txTools'
import { GeneralUtils } from '../contracts/generalUtils'
import * as tools from 'uint8array-tools'
import { Tap } from '@cmdcode/tapscript'
import { SHPreimage } from '../contracts/sigHashUtils'

export const MAX_OUTPUT_SCRIPT_LEN = 34

const SCHNORR_SIG_LEN = 0x41 // a normal schnorr signature size with sigHashType is 65 bytes
export type InputIndex = number
type Witness = Buffer[]
export const DUST_LIMIT = 330

export interface TransactionInput {
  hash: string | Uint8Array
  index: number
  sequence?: number
}

type Finalizer = (
  self: ExtPsbt,
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
  tapLeafHashToFinalize?: Uint8Array
) => Witness

type AsyncFinalizer = (
  self: ExtPsbt,
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
  tapLeafHashToFinalize?: Uint8Array
) => Promise<Witness>

interface PsbtInputExtended extends PsbtInput, TransactionInput {
  finalizer?: Finalizer
  sigRequests?: {
    inputIndex: InputIndex
    options: Omit<ToSignInput, 'index'>
  }[]
}

export type UnlockArgsBuilder = (
  curPsbt: ExtPsbt,
  tapLeafContract: TapLeafSmartContract
) => any[]

export type SubContractCall = {
  contractAlias?: string
  method: string
  argsBuilder: UnlockArgsBuilder
}

export type InputCtx = {
  shPreimage: SHPreimage
  spentSPKs: SpentSPKs
}

type FinalTaprootScriptsFunc = (
  inputIndex: number, // Which input is it?
  input: PsbtInput, // The PSBT input contents
  tapLeafHashToFinalize?: Uint8Array
) => {
  finalScriptWitness: Uint8Array | undefined
}

const dummySigner = TestWallet.random(new DummyProvider())
// const dummySigner = new DefaultSigner();
// (dummySigner as any).isAuthenticated = () => Promise.resolve(true);

export class ExtPsbt extends Psbt {
  private finalizers: Map<InputIndex, AsyncFinalizer> = new Map()
  private sigRequests: Map<InputIndex, Omit<ToSignInput, 'index'>[]> = new Map()
  private changeOutputIndex?: number
  private _stateHashes: string[] = []

  constructor(opts?: PsbtOptsOptional) {
    super(opts)
  }

  get isFinalized(): boolean {
    return this.data.inputs.reduce((finalized, input) => {
      return finalized && isFinalized(input)
    }, true)
  }

  toTxHex(): string {
    return this.isFinalized
      ? this.extractTransaction(true).toHex()
      : this.unsignedTx.toHex()
  }

  get unsignedTx(): Transaction {
    const c = (this as any).__CACHE
    return c.__TX
  }

  override addInput(inputData: PsbtInputExtended): this {
    super.addInput(inputData)
    this._checkInputCnt()

    if (inputData.finalizer) {
      const index = this.data.inputs.length - 1
      const input = this.data.inputs[index]
      const witness = inputData.finalizer(this, index, input)
      this._cacheInputWitness(index, witness)
      const finalizer = inputData.finalizer
      this.setInputFinalizer(index, async (self, idx, inp) => {
        return finalizer(self, idx, inp)
      })
    }
    if (inputData.sigRequests) {
      for (const sigRequest of inputData.sigRequests) {
        this._addSigRequest(sigRequest.inputIndex, sigRequest.options)
      }
    }
    return this
  }

  addFeeInputs(feeUtxos: UTXO[]): this {
    for (const utxo of feeUtxos) {
      const script = Buffer.from(utxo.script, 'hex')
      this.addInput({
        hash: utxo.txId,
        index: utxo.outputIndex,
        witnessUtxo: {
          script,
          value: BigInt(utxo.satoshis),
        },
      })
      const index = this.txInputs.length - 1
      this._addSigRequest(index, {
        address: script2Addr(script, this.opts.network),
      })
    }
    return this
  }

  addCovenantInput<T>(
    covenant: Covenant<T>,
    subContractAlias: string = 'default'
  ): this {
    const fromUtxo = covenant.utxo
    if (!fromUtxo) {
      throw new Error('Covenant input must be bind to a fromUtxo')
    }
    const script = Buffer.from(fromUtxo.script, 'hex')
    const subContract = covenant.getTapLeafContract(subContractAlias)

    if (script.compare(covenant.lockingScript.toBuffer()) !== 0) {
      throw new Error('Covenant input script mismatch')
    }

    this.addInput({
      hash: fromUtxo.txId,
      index: fromUtxo.outputIndex,
      witnessUtxo: {
        script,
        value: BigInt(fromUtxo.satoshis),
      },
      tapLeafScript: [
        {
          leafVersion: LEAF_VERSION_TAPSCRIPT,
          script: subContract.contractScript.toBuffer(),
          controlBlock: subContract.controlBlock,
        },
      ],
    })

    this._checkInputCnt()
    return this
  }

  updateCovenantInput<T>(
    inputIndex: number,
    covenant: Covenant<T>,
    subContractCall: SubContractCall
  ): this {
    const tapLeafContract = covenant.getTapLeafContract(
      subContractCall.contractAlias
    )

    const tapLeafWitness: Witness = [
      tapLeafContract.contractScript.toBuffer(),
      tapLeafContract.controlBlock,
    ]

    const args = subContractCall.argsBuilder(this, tapLeafContract)
    const contractCallWitness = tapLeafContract.contractCallToWitness(
      subContractCall.method,
      args
    )
    const witness = [...contractCallWitness, ...tapLeafWitness]
    this._cacheInputWitness(inputIndex, witness)

    const asyncFinalizer = async (
      self: ExtPsbt,
      _idx: number,
      _inp: PsbtInput
    ) => {
      const args = subContractCall.argsBuilder(self, tapLeafContract)

      const subContract = tapLeafContract.contract
      await subContract.connect(dummySigner as any)
      const contractTx = await subContract.methods[subContractCall.method](
        ...args,
        {
          fromUTXO: getDummyUtxo(),
          verify: false,
          // exec: false,
        }
      )
      const finalContractCallWitness = contractTxToWitness(contractTx)
      const witness = [...finalContractCallWitness, ...tapLeafWitness]
      return witness
    }
    this.setInputFinalizer(inputIndex, asyncFinalizer)

    return this
  }

  addStateOutput(): this {
    if (this.txOutputs.length > 0) {
      throw new Error('state output can only be added at the first output')
    }
    // add a dummy state output;
    const stateOutputScript = this.stateScript
    this.addOutput({
      script: stateOutputScript,
      value: BigInt(0),
    })
    return this
  }

  get stateScript(): Uint8Array {
    const stateOutput = GeneralUtils.getStateOutput(
      this.stateHashes[0] || sha256(''),
      this.stateHashes[1]
    )
    const script = tools.fromHex(stateOutput.slice(18)) // remove satoshis, script length
    return script
  }

  get stateHashes() {
    return [this._stateHashes[0] || '', this._stateHashes[1] || ''] as const
  }

  addCovenantOutput<T>(covenant: Covenant<T>, satoshis: number = 330): this {
    this.addOutput({
      script: covenant.lockingScript.toBuffer(),
      value: BigInt(satoshis),
    })
    this._checkOutputCnt()
    const state = covenant.stateHash
    this._stateHashes.push(state)
    if (this._stateHashes.length > 2) {
      throw new Error('only support two covenant outputs')
    }
    this.unsignedTx.outs[0].script = this.stateScript
    return this
  }

  get inputAmount(): number {
    return this.data.inputs.reduce(
      (total, input) => total + Number(input.witnessUtxo!.value),
      0
    )
  }

  get outputAmount(): number {
    return this.txOutputs.reduce(
      (total, output) => total + Number(output.value),
      0
    )
  }

  change(address: string, feeRate: number, estimatedVsize?: number): this {
    const estVSize = estimatedVsize || this.estimateVSize() // NOTE: this may be inaccurate due to the unknown witness size

    const changeAmount =
      this.inputAmount - this.outputAmount - estVSize * feeRate

    if (changeAmount < 0) {
      throw new Error(
        `Insufficient input satoshis! input(${this.inputAmount}) < output(${this.outputAmount})`
      )
    }

    if (changeAmount >= DUST_LIMIT) {
      this.addOutput({
        script: btc.Script.fromAddress(
          validteSupportedAddress(address)
        ).toBuffer(),
        value: BigInt(Math.ceil(changeAmount)),
      })
      const index = this.txOutputs.length - 1
      this.changeOutputIndex = index
    }

    return this
  }

  psbtOptions(autoFinalized = false): PSBTOptions | undefined {
    const toSignInputs: ToSignInput[] = []
    this.sigRequests.forEach((sigReqs, index) => {
      sigReqs.forEach((sigReq) => {
        toSignInputs.push({
          index,
          ...sigReq,
        })
      })
    })
    return toSignInputs.length === 0
      ? undefined
      : {
          autoFinalized,
          toSignInputs,
        }
  }

  setInputFinalizer(inputIndex: InputIndex, finalizer: AsyncFinalizer): this {
    this.finalizers.set(inputIndex, finalizer)
    return this
  }

  override finalizeAllInputs(): this {
    checkForInput(this.data.inputs, 0) // making sure we have at least one
    this.data.inputs.forEach((_, idx) => {
      const finalizer = this.finalizers.get(idx)
      if (finalizer) {
        throw new Error(
          `Found async finalizer on input ${idx}, please call 'finalizeAllInputsAsync' instead!`
        )
      }
      this.finalizeInput(idx)
    })
    return this
  }

  async finalizeAllInputsAsync(): Promise<this> {
    checkForInput(this.data.inputs, 0) // making sure we have at least one

    for (let idx = 0; idx < this.data.inputs.length; idx++) {
      const input = this.data.inputs[idx]
      let finalFunc: FinalTaprootScriptsFunc | undefined = undefined
      const finalizer = this.finalizers.get(idx)
      if (finalizer) {
        try {
          const witness = await finalizer(this, idx, input)
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          finalFunc = (
            _inputIdx: number,
            _input: PsbtInput,
            _tapLeafHashToFinalize?: Uint8Array
          ) => {
            return {
              finalScriptWitness: witnessStackToScriptWitness(witness),
            }
          }
        } catch (error) {
          console.error(`Failed to finalize input ${idx}, `, error)
          throw error
        }
      }
      this.finalizeInput(idx, finalFunc)
    }
    return this
  }

  getSig(inputIndex: InputIndex, options: Omit<ToSignInput, 'index'>): Sig {
    const input = this.data.inputs[inputIndex]
    let signature = Uint8Array.from(Buffer.alloc(SCHNORR_SIG_LEN))

    this._addSigRequest(inputIndex, options)

    if (input.tapScriptSig) {
      const tsSig = input.tapScriptSig.find((tapScriptSig) => {
        const tapleafHashMatch =
          !options.tapLeafHashToSign ||
          Buffer.from(tapScriptSig.leafHash).toString('hex') ===
            options.tapLeafHashToSign
        const pubKeyMatch =
          !options.publicKey ||
          Buffer.from(tapScriptSig.pubkey).toString('hex') ===
            toXOnly(options.publicKey, true) ||
          Buffer.from(tapScriptSig.pubkey).toString('hex') ===
            toXOnly(options.publicKey, false)
        return tapleafHashMatch && pubKeyMatch
      })
      if (tsSig) {
        signature = tsSig.signature
      }
    }

    if (input.partialSig) {
      const pSig = input.partialSig.find((partialSig) => {
        const sigAddr = xPubkeyToAddr(
          Buffer.from(partialSig.pubkey).toString('hex')
        )
        const reqAddr =
          options.address ||
          (options.publicKey ? xPubkeyToAddr(options.publicKey) : undefined)
        reqAddr === undefined || sigAddr === reqAddr
      })
      if (pSig) {
        signature = pSig.signature
      }
    }

    return Sig(Buffer.from(signature).toString('hex'))
  }

  getChangeOutput(): ByteString {
    if (this.changeOutputIndex === undefined) {
      return toByteString('')
    }

    const changeOutput = this.txOutputs[this.changeOutputIndex]
    if (!changeOutput) {
      throw new Error(
        `Change output not found at index ${this.changeOutputIndex}`
      )
    }
    const len = changeOutput.script.length
    if (len > MAX_OUTPUT_SCRIPT_LEN) {
      throw new Error(
        `Change output script length ${len} exceeds the limit of ${MAX_OUTPUT_SCRIPT_LEN}`
      )
    }
    return (
      bigintToByteString(BigInt(changeOutput.value), BigInt(8)) +
      bigintToByteString(BigInt(len), 1n) +
      tools.toHex(changeOutput.script)
    )
  }

  getUtxo(outputIndex: number): UTXO {
    if (!this.txOutputs[outputIndex]) {
      throw new Error(`Output at index ${outputIndex} is not found`)
    }
    return {
      txId: this.unsignedTx.getId(),
      outputIndex: outputIndex,
      script: Buffer.from(this.txOutputs[outputIndex].script).toString('hex'),
      satoshis: Number(this.txOutputs[outputIndex].value),
    }
  }

  estimateVSize(): number {
    const compensation = 1 // vsize diff compensation in bytes
    return (
      this.unsignedTx.virtualSize() +
      this._unfinalizedWitnessVsize() +
      compensation
    )
  }

  estimateFee(feeRate: number): number {
    return this.estimateVSize() * feeRate
  }

  private _unfinalizedWitnessVsize(): number {
    let size = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.data.inputs.forEach((input, _inputIndex) => {
      if (!isTaprootInput(input)) {
        // p2wpkh
        const P2WPKH_SIG_LEN = 0x49 // 73 bytes signature
        const P2WPKH_PUBKEY_LEN = 0x21 // 33 bytes pubkey
        size += P2WPKH_SIG_LEN + P2WPKH_PUBKEY_LEN
      } else {
        // p2tr
        if (!isFinalized(input)) {
          if ((input.unknownKeyVals || []).length > 0) {
            // use unknownKeyVals as a place to store witness before sign
            const unfinalizedWitness = (input.unknownKeyVals || []).map((v) =>
              Buffer.from(v.value)
            )
            size += witnessStackToScriptWitness(unfinalizedWitness).length
          } else if ((input.tapLeafScript || []).length > 0) {
            const tapLeafScript = (input.tapLeafScript || [])[0]
            const unfinalizedWitness = [
              Buffer.alloc(SCHNORR_SIG_LEN),
              Buffer.from(tapLeafScript.script),
              Buffer.from(tapLeafScript.controlBlock),
            ]
            size += witnessStackToScriptWitness(unfinalizedWitness).length
          } else if ((input.tapKeySig || []).length > 0) {
            size += (input.tapKeySig || []).length
          } else {
            const unfinalizedWitness = [Buffer.alloc(SCHNORR_SIG_LEN)]
            size += witnessStackToScriptWitness(unfinalizedWitness).length
          }
        } else {
          if (input.finalScriptSig) {
            size += input.finalScriptSig.length
          } else if (input.finalScriptWitness) {
            size += input.finalScriptWitness.length
          } else {
            throw new Error(
              'The taproot input should be finalized with either finalScriptSig or finalScriptWitness'
            )
          }
        }
      }
    })
    return Math.ceil(size / 4)
  }

  calculateInputCtxs(): Map<InputIndex, InputCtx> {
    const tx = toBtcTransaction(this, false)

    const inputTapLeafHashes = this.data.inputs
      .map((input, inputIndex) => {
        if (input.tapLeafScript) {
          return {
            inputIndex,
            tapLeafHash: Buffer.from(
              Tap.encodeScript(
                input.tapLeafScript[0].script,
                LEAF_VERSION_TAPSCRIPT
              ),
              'hex'
            ),
          }
        }
        return undefined
      })
      .filter((input) => input !== undefined)

    const preimages = this.calculateInputSHPreimages(tx, inputTapLeafHashes)

    return inputTapLeafHashes.reduce((result, { inputIndex }, index) => {
      const { SHPreimageObj } = preimages[index]
      const spentScriptsCtx = getSpentScripts(tx)
      result.set(inputIndex, {
        shPreimage: SHPreimageObj,
        spentSPKs: spentScriptsCtx,
      })
      return result
    }, new Map<InputIndex, InputCtx>())
  }

  calculateInputSHPreimages(
    tx: btc.Transaction,
    inputTapLeafHashes: { inputIndex: number; tapLeafHash: Buffer }[]
  ) {
    let eList: Array<any> = []
    let eBuffList: Array<any> = []
    let sighashList: Array<{
      preimage: Buffer
      hash: Buffer
    }> = []

    let found = false

    const input = tx.inputs[tx.inputs.length - 1]
    // eslint-disable-next-line no-constant-condition
    while (true) {
      sighashList = inputTapLeafHashes.map((input) => {
        const sighash = getSigHashSchnorr(
          tx,
          input.tapLeafHash,
          input.inputIndex
        )
        return sighash
      })
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
      input.sequenceNumber -= 1
    }

    if (!found) {
      throw new Error('No valid preimage found!')
    }

    this.unsignedTx.ins[tx.inputs.length - 1].sequence = input.sequenceNumber

    return inputTapLeafHashes.map((_, index) => {
      const eBuff = eBuffList[index]
      const sighash = sighashList[index]
      const _e = eBuff.slice(0, eBuff.length - 1) // e' - e without last byte
      const lastByte = eBuff[eBuff.length - 1]
      const preimageParts = splitSighashPreimage(sighash.preimage)
      return {
        SHPreimageObj: toSHPreimageObj(preimageParts, _e, lastByte),
        sighash: sighash,
      }
    })
  }

  private _checkInputCnt() {
    const inputCnt = this.data.inputs.length
    if (inputCnt > MAX_INPUT) {
      throw new Error(
        `This CatPsbt has ${inputCnt} inputs which exceeds the limit of ${MAX_INPUT}`
      )
    }
  }

  private _checkOutputCnt() {
    const outputCnt = this.data.outputs.length
    if (outputCnt > MAX_OUTPUT) {
      throw new Error(
        `This CatPsbt has ${outputCnt} outputs which exceeds the limit of ${MAX_OUTPUT}`
      )
    }
  }

  private _cacheInputWitness(inputIndex: InputIndex, witness: Witness) {
    // put witness into unknownKeyVals to support autoFinalize in signer
    witness.forEach((wit, widx) => {
      this.data.addUnknownKeyValToInput(inputIndex, {
        key: Buffer.from(widx.toString()),
        value: wit,
      })
    })
  }

  private _addSigRequest(
    inputIndex: InputIndex,
    options: Omit<ToSignInput, 'index'>
  ) {
    const sigRequests = this.sigRequests.get(inputIndex) || []
    sigRequests.push(options)
    this.sigRequests.set(inputIndex, sigRequests)
  }
}
