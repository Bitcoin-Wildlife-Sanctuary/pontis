import {
  ByteString,
  len,
  PubKey,
  sha256,
  Sha256,
  toByteString,
} from 'scrypt-ts'
import { Covenant } from '../lib/covenant'
import { SupportedNetwork } from '../lib/constants'
import { DepositAggregator, DepositData } from '../contracts/depositAggregator'
import { InputCtx, SubContractCall } from '../lib/extPsbt'
import {
  AggregatorTransaction,
  AggregatorUtils,
} from '../contracts/aggregatorUtils'
import { ChainProvider, DepositAggregatorUtxo } from '../lib/provider'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import { getTxId, toXOnly } from '../lib/utils'
import {
  createEmptySha256,
  inputToByteString,
  isTxHashEqual,
  locktimeToByteString,
  outputToByteString,
  splitHashFromStateOutput,
  versionToByteString,
} from '../lib/txTools'
import * as tools from 'uint8array-tools'
import { BatchID } from '../util/merkleUtils'

export type DepositAggregatorState = {
  level: bigint

  // todo: confirm address length? 32 bytes?
  // level = 0, state = sha256(levelByteString + sha256(depositAddress + depositAmt))
  depositAddress: ByteString
  depositAmt: bigint

  // level > 0, state = sha256(levelByteString + prevHashData0 + prevHashData1)
  prevHashData0: Sha256
  prevHashData1: Sha256
}

export function stateToBatchID(
  state: DepositAggregatorState,
  prevTxid: string
): BatchID {
  const hash =
    state.level === 0n
      ? DepositAggregator.hashDepositData(
          0n,
          state.depositAddress,
          state.depositAmt
        )
      : DepositAggregator.hashAggregatedDepositData(
          state.level,
          state.prevHashData0,
          state.prevHashData1
        )
  /// add prevTxid to the hash to make it unique
  return sha256(prevTxid + hash)
}

type InputTrace1 = {
  prevTx0: AggregatorTransaction
  prevTx1: AggregatorTransaction
  ancestorTx0: AggregatorTransaction
  ancestorTx1: AggregatorTransaction
  ancestorTx2: AggregatorTransaction
  ancestorTx3: AggregatorTransaction
}

type InputTrace = {
  prevTx: AggregatorTransaction
  ancestorTx0: AggregatorTransaction
  ancestorTx1: AggregatorTransaction
}

export type TracedDepositAggregator1 = {
  covenant0: DepositAggregatorCovenant
  covenant1: DepositAggregatorCovenant
  trace: InputTrace1
  rawtx: {
    prevTx0: string
    prevTx1: string
    ancestorTx0: string
    ancestorTx1: string
    ancestorTx2: string
    ancestorTx3: string
  }
}

export type TracedDepositAggregator = {
  covenant: DepositAggregatorCovenant

  trace: InputTrace

  rawtx: {
    prevTx: string
    ancestorTx0: string
    ancestorTx1: string
  }
}

export interface TraceableDepositAggregatorUtxo extends DepositAggregatorUtxo {
  operator: PubKey
  bridgeSPK: ByteString
}

export class DepositAggregatorCovenant extends Covenant<DepositAggregatorState> {
  static readonly LOCKED_ASM_VERSION = 'dc1b263974ed04fc15d9f67f57a4e881'

  constructor(
    readonly operator: PubKey,
    readonly bridgeSPK: ByteString,
    state: DepositAggregatorState,
    network?: SupportedNetwork
  ) {
    if (len(operator) !== 33n) {
      throw new Error('operator pubkey invalid')
    }
    super(
      [
        {
          // todo: confirm address type
          contract: new DepositAggregator(
            PubKey(toXOnly(operator, true)),
            bridgeSPK
          ),
          // contract: new DepositAggregator(operator, bridgeSPK),
        },
      ],
      {
        lockedAsmVersion: DepositAggregatorCovenant.LOCKED_ASM_VERSION,
        network: network,
      }
    )
    this.state = state
  }

  serializedState(): ByteString {
    if (this.state.level === 0n) {
      return DepositAggregator.hashDepositData(
        0n,
        this.state.depositAddress,
        this.state.depositAmt
      )
    } else {
      return DepositAggregator.hashAggregatedDepositData(
        this.state.level,
        this.state.prevHashData0,
        this.state.prevHashData1
      )
    }
  }

  finalizeL1(
    inputIndex: number,
    inputCtxs: Map<number, InputCtx>,

    prevTx: AggregatorTransaction,
    prevTxLevel: bigint,
    ancestorTx0: AggregatorTransaction,
    ancestorTx1: AggregatorTransaction,
    bridgeTxId: Sha256,
    fundingPrevout: ByteString
  ): SubContractCall {
    const subCall: SubContractCall = {
      method: 'finalizeL1',
      argsBuilder: (self, _tapLeafContract) => {
        const { shPreimage, spentSPKs } = inputCtxs.get(inputIndex)
        if (!shPreimage) {
          throw new Error('Input context is not available')
        }
        const args = [
          shPreimage,
          () => {
            return self.getSig(inputIndex, {
              publicKey: this.operator.toString(),
            })
          },
          prevTx,
          prevTxLevel,
          ancestorTx0,
          ancestorTx1,
          bridgeTxId,
          spentSPKs,
          fundingPrevout,
        ]
        return args
      },
    }
    return subCall
  }

  aggregate(
    inputIndex: number,
    inputCtxs: Map<number, InputCtx>,

    prevTx0: AggregatorTransaction,
    prevTx1: AggregatorTransaction,

    ancestorTx0: AggregatorTransaction,
    ancestorTx1: AggregatorTransaction,
    ancestorTx2: AggregatorTransaction,
    ancestorTx3: AggregatorTransaction,

    fundingPrevout: ByteString,
    isFirstInput: boolean,
    depositData0: DepositData,
    depositData1: DepositData
  ): SubContractCall {
    const subCall: SubContractCall = {
      method: 'aggregate',
      argsBuilder: (self, _tapLeafContract) => {
        const { shPreimage } = inputCtxs.get(inputIndex)
        if (!shPreimage) {
          throw new Error('Input context is not available')
        }
        const args = [
          shPreimage,
          // todo: check pubkey is p2tr
          () => {
            return self.getSig(inputIndex, {
              publicKey: this.operator.toString(),
            })
          },
          this.state.level,
          prevTx0,
          prevTx1,
          ancestorTx0,
          ancestorTx1,
          ancestorTx2,
          ancestorTx3,
          fundingPrevout,
          isFirstInput,
          depositData0,
          depositData1,
          self.getChangeOutput(),
        ]
        return args
      },
    }
    return subCall
  }

  private static getAggregatorTransaction(
    tx: Transaction,
    level: bigint
  ): AggregatorTransaction {
    if (level === 0n) {
      if (tx.ins.length !== 1) {
        throw new Error(
          'Invalid deposit aggregator tx: leaf tx must only have one input'
        )
      }
    } else {
      if (tx.ins.length !== 3) {
        throw new Error(
          'Invalid deposit aggregator tx: non-leaf tx must have three inputs'
        )
      }
    }

    return {
      ver: versionToByteString(tx),
      inputContract0: level === 0n ? '' : inputToByteString(tx, 0),
      inputContract1: level === 0n ? '' : inputToByteString(tx, 1),
      inputFee:
        level === 0n ? inputToByteString(tx, 0) : inputToByteString(tx, 2),

      // the contract output is always the first output
      // the hash data output is always the second output
      // the change output is always the third output, if exists
      outputContractAmt: tx.outs[1].value,
      outputContractSPK: tools.toHex(tx.outs[1].script),
      hashData: Sha256(splitHashFromStateOutput(tx)[0]),
      changeOutput: tx.outs.length > 2 ? outputToByteString(tx, 2) : '',
      locktime: locktimeToByteString(tx),
    }
  }
  private static createEmptyAggregatorTransaction(): AggregatorTransaction {
    return {
      ver: '',
      inputContract0: '',
      inputContract1: '',
      inputFee: '',
      outputContractAmt: 0n,
      outputContractSPK: '',
      hashData: createEmptySha256(),
      changeOutput: '',
      locktime: '',
    }
  }

  get depositData(): DepositData {
    if (this.state.level === 0n) {
      return {
        address: this.state.depositAddress,
        amount: this.state.depositAmt,
      }
    } else {
      return {
        address: '',
        amount: 0n,
      }
    }
  }

  static async backtrace(
    utxo: TraceableDepositAggregatorUtxo,
    chainProvider: ChainProvider
  ): Promise<TracedDepositAggregator> {
    const level = utxo.state.level

    const covenant = new DepositAggregatorCovenant(
      utxo.operator,
      utxo.bridgeSPK,
      utxo.state
    )
    if (utxo.utxo.script !== covenant.lockingScriptHex) {
      throw new Error('invalid deposit aggregator utxo')
    }

    const prevRawtx = await chainProvider.getRawTransaction(utxo.utxo.txId)
    const prevTx = Transaction.fromHex(prevRawtx)

    const prevTxInContract = DepositAggregatorCovenant.getAggregatorTransaction(
      prevTx,
      level
    )
    if (
      !isTxHashEqual(
        prevTx,
        AggregatorUtils.getTxId(prevTxInContract, level === 0n)
      )
    ) {
      throw new Error('prevTx txid mismatch')
    }

    if (level === 0n) {
      return {
        covenant,
        trace: {
          prevTx: prevTxInContract,
          ancestorTx0:
            DepositAggregatorCovenant.createEmptyAggregatorTransaction(),
          ancestorTx1:
            DepositAggregatorCovenant.createEmptyAggregatorTransaction(),
        },
        rawtx: {
          prevTx: prevRawtx,
          ancestorTx0: '',
          ancestorTx1: '',
        },
      }
    } else {
      if (prevTx.ins.length !== 3) {
        throw new Error(
          'Invalid depost aggregator tx: non-leaf tx must have three inputs'
        )
      }
      const ancestorRawtx0 = await chainProvider.getRawTransaction(
        getTxId(prevTx.ins[0])
      )
      const ancestorRawtx1 = await chainProvider.getRawTransaction(
        getTxId(prevTx.ins[1])
      )
      const ancestorTx0 = Transaction.fromHex(ancestorRawtx0)
      const ancestorTx1 = Transaction.fromHex(ancestorRawtx1)

      const ancestorTx0InContract =
        DepositAggregatorCovenant.getAggregatorTransaction(
          ancestorTx0,
          level - 1n
        )
      const ancestorTx1InContract =
        DepositAggregatorCovenant.getAggregatorTransaction(
          ancestorTx1,
          level - 1n
        )

      if (
        !isTxHashEqual(
          ancestorTx0,
          AggregatorUtils.getTxId(ancestorTx0InContract, level - 1n === 0n)
        )
      ) {
        throw new Error('ancestorTx0 txid mismatch')
      }
      if (
        !isTxHashEqual(
          ancestorTx1,
          AggregatorUtils.getTxId(ancestorTx1InContract, level - 1n === 0n)
        )
      ) {
        throw new Error('ancestorTx1 txid mismatch')
      }

      return {
        covenant,
        trace: {
          prevTx: prevTxInContract,
          ancestorTx0: ancestorTx0InContract,
          ancestorTx1: ancestorTx1InContract,
        },
        rawtx: {
          prevTx: prevRawtx,
          ancestorTx0: ancestorRawtx0,
          ancestorTx1: ancestorRawtx1,
        },
      }
    }
  }

  static createEmptyState(): DepositAggregatorState {
    return {
      level: 0n,
      depositAddress: toByteString(''),
      depositAmt: 0n,
      prevHashData0: createEmptySha256(),
      prevHashData1: createEmptySha256(),
    }
  }

  static createDepositState(
    depositAddress: ByteString,
    depositAmt: bigint
  ): DepositAggregatorState {
    return {
      level: 0n,
      depositAddress,
      depositAmt,
      prevHashData0: createEmptySha256(),
      prevHashData1: createEmptySha256(),
    }
  }

  static createAggregateState(
    level: bigint,
    prevHashData0: Sha256,
    prevHashData1: Sha256
  ): DepositAggregatorState {
    return {
      level,
      depositAddress: toByteString(''),
      depositAmt: 0n,
      prevHashData0,
      prevHashData1,
    }
  }
}
