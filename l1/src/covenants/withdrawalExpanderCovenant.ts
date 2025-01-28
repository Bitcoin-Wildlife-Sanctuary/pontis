import { ByteString, int2ByteString, PubKey, Sha256 } from 'scrypt-ts'
import { Covenant } from '../lib/covenant'
import { SupportedNetwork } from '../lib/constants'
import {
  ExpanderTransaction,
  WithdrawalExpander,
} from '../contracts/withdrawalExpander'
import { InputCtx, SubContractCall } from '../lib/extPsbt'
import {
  createEmptySha256,
  inputToByteString,
  isTxHashEqual,
  locktimeToByteString,
  outputToByteString,
  splitHashFromStateOutput,
  versionToByteString,
} from '../lib/txTools'
import { ChainProvider, WithdrawalExpanderUtxo } from '../lib/provider'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import * as tools from 'uint8array-tools'

export type WithdrawalExpanderState = {
  level: bigint

  // level = 0, state = sha256(levelByteString + sha256(withdrawAddress + withdrawAmt))
  withdrawAddressScript: ByteString
  withdrawAmt: bigint

  // level > 0, state = sha256(levelByteString + leftAmt + leftChildRootHash + rightAmt + rightChildRootHash)
  leftChildRootHash: Sha256
  rightChildRootHash: Sha256
  leftAmt: bigint
  rightAmt: bigint
}

export interface TraceableWithdrawalExpanderUtxo
  extends WithdrawalExpanderUtxo {
  operator: PubKey
}

export type TracedWithdrawalExpander = {
  covenant: WithdrawalExpanderCovenant
  trace: {
    prevTx: ExpanderTransaction
  }
  rawtx: {
    prevTx: string
  }
}

export class WithdrawalExpanderCovenant extends Covenant<WithdrawalExpanderState> {
  static readonly LOCKED_ASM_VERSION = 'd3a800a2b377c663b0fa9538a8cce450'

  constructor(
    readonly operator: PubKey,
    state: WithdrawalExpanderState,
    network?: SupportedNetwork
  ) {
    super(
      [
        {
          contract: new WithdrawalExpander(operator),
        },
      ],
      {
        lockedAsmVersion: WithdrawalExpanderCovenant.LOCKED_ASM_VERSION,
        network: network,
      }
    )
    this.state = state
  }

  distribute(
    inputIndex: number,
    inputCtxs: Map<number, InputCtx>,

    isFirstExpanderOutput: boolean,
    prevLevel: bigint,

    prevTx: ExpanderTransaction,

    withdrawalAddresses: Array<ByteString>,
    withdrawalAmts: Array<bigint>,

    fundingPrevout: ByteString
  ): SubContractCall {
    if (withdrawalAddresses.length !== 4) {
      throw new Error('withdrawalAddresses length should be 4')
    }
    if (withdrawalAmts.length !== 4) {
      throw new Error('withdrawalAmts length should be 4')
    }

    const subCall: SubContractCall = {
      method: 'distribute',
      argsBuilder: (self, _tapLeafContract) => {
        const { shPreimage } = inputCtxs.get(inputIndex)
        if (!shPreimage) {
          throw new Error('Input context is not available')
        }

        return [
          shPreimage,
          () => {
            return self.getSig(inputIndex, {
              publicKey: this.operator.toString(),
            })
          },

          isFirstExpanderOutput,

          prevLevel,
          prevTx,

          withdrawalAddresses,
          withdrawalAmts,

          fundingPrevout,
          self.getChangeOutput(),
        ]
      },
    }
    return subCall
  }

  expand(
    inputIndex: number,
    inputCtxs: Map<number, InputCtx>,

    isFirstExpanderOutput: boolean,

    prevTx: ExpanderTransaction,

    fundingPrevout: ByteString
  ): SubContractCall {
    const state = this.state!
    const subCall: SubContractCall = {
      method: 'expand',
      argsBuilder: (self, _tapLeafContract) => {
        const { shPreimage } = inputCtxs.get(inputIndex)
        if (!shPreimage) {
          throw new Error('Input context is not available')
        }

        return [
          shPreimage,
          () => {
            return self.getSig(inputIndex, {
              publicKey: this.operator.toString(),
            })
          },

          isFirstExpanderOutput,

          state.level,
          prevTx,

          state.leftChildRootHash,
          state.rightChildRootHash,

          state.leftAmt,
          state.rightAmt,

          fundingPrevout,
          self.getChangeOutput(),
        ]
      },
    }
    return subCall
  }

  static async backtrace(
    utxo: TraceableWithdrawalExpanderUtxo,
    chainProvider: ChainProvider
  ): Promise<TracedWithdrawalExpander> {
    const covenant = new WithdrawalExpanderCovenant(utxo.operator, utxo.state)
    if (utxo.utxo.script !== covenant.lockingScriptHex) {
      throw new Error('invalid withdrawal expander utxo')
    }

    const prevRawtx = await chainProvider.getRawTransaction(utxo.utxo.txId)
    const prevTx = Transaction.fromHex(prevRawtx)

    const prevTxInContract =
      WithdrawalExpanderCovenant.getExpanderTransaction(prevTx)
    const txid = WithdrawalExpander.getTxId(prevTxInContract)
    if (!isTxHashEqual(prevTx, txid)) {
      throw new Error('txid mismatch')
    }

    return {
      covenant,
      trace: {
        prevTx: prevTxInContract,
      },
      rawtx: {
        prevTx: prevRawtx,
      },
    }
  }

  private static getExpanderTransaction(tx: Transaction): ExpanderTransaction {
    const isSingleExpanderOutput = tx.outs.length <= 3
    let isCreateWithdrawalTx = false
    if (!isSingleExpanderOutput) {
      isCreateWithdrawalTx =
        tools.compare(tx.outs[0].script, tx.outs[2].script) != 0
    }

    let bridgeSPK = ''
    let bridgeAmt = 0n
    let bridgeStateHash = createEmptySha256()
    if (isCreateWithdrawalTx) {
      bridgeSPK = tools.toHex(tx.outs[0].script)
      bridgeAmt = tx.outs[0].value
      bridgeStateHash = Sha256(splitHashFromStateOutput(tx, 1))
    }

    const contractSPK = isCreateWithdrawalTx
      ? tools.toHex(tx.outs[2].script)
      : tools.toHex(tx.outs[0].script)
    const output0Amt = isCreateWithdrawalTx
      ? tx.outs[2].value
      : tx.outs[0].value
    const stateHash0 = isCreateWithdrawalTx
      ? Sha256(splitHashFromStateOutput(tx, 3))
      : Sha256(splitHashFromStateOutput(tx, 1))

    let output1Amt = 0n
    let stateHash1 = createEmptySha256()
    if (!isCreateWithdrawalTx && !isSingleExpanderOutput) {
      output1Amt = tx.outs[2].value
      stateHash1 = Sha256(splitHashFromStateOutput(tx, 3))
    }

    let changeOutput = ''
    if (tx.outs.length === 3 || tx.outs.length === 5) {
      changeOutput = outputToByteString(tx, tx.outs.length - 1)
    }

    const res = {
      ver: versionToByteString(tx),
      inputs:
        int2ByteString(BigInt(tx.ins.length)) +
        tx.ins
          .map((_, inputIndex) => inputToByteString(tx, inputIndex))
          .join(''),

      isCreateWithdrawalTx,

      bridgeSPK,
      bridgeAmt,
      bridgeStateHash,

      contractSPK,
      output0Amt,
      stateHash0,

      output1Amt,
      stateHash1,

      changeOutput,
      locktime: locktimeToByteString(tx),
    }
    return res
  }

  serializedState(): ByteString {
    if (this.state.level === 0n) {
      return WithdrawalExpander.getLeafNodeHash(
        this.state.withdrawAddressScript,
        this.state.withdrawAmt
      )
    } else {
      return WithdrawalExpander.getNodeHash(
        this.state.level,
        this.state.leftAmt,
        this.state.leftChildRootHash,
        this.state.rightAmt,
        this.state.rightChildRootHash
      )
    }
  }

  static createNonLeafState(
    level: bigint,
    leftChildRootHash: Sha256,
    rightChildRootHash: Sha256,
    leftAmt: bigint,
    rightAmt: bigint
  ): WithdrawalExpanderState {
    return {
      level,
      withdrawAddressScript: '',
      withdrawAmt: BigInt(0),
      leftChildRootHash,
      rightChildRootHash,
      leftAmt,
      rightAmt,
    }
  }

  static createLeafState(
    withdrawAddressScript: ByteString,
    withdrawAmt: bigint
  ): WithdrawalExpanderState {
    return {
      level: 0n,
      withdrawAddressScript,
      withdrawAmt,
      leftChildRootHash: createEmptySha256(),
      rightChildRootHash: createEmptySha256(),
      leftAmt: BigInt(0),
      rightAmt: BigInt(0),
    }
  }

  static createEmptyState(): WithdrawalExpanderState {
    return {
      level: 0n,
      withdrawAddressScript: '',
      withdrawAmt: BigInt(0),
      leftChildRootHash: createEmptySha256(),
      rightChildRootHash: createEmptySha256(),
      leftAmt: BigInt(0),
      rightAmt: BigInt(0),
    }
  }
}
