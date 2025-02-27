import {
  ByteString,
  len,
  PubKey,
  sha256,
  Sha256,
  toByteString,
  byteString2Int
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
  INITIAL_DEPOSIT_AGGREGATOR_STATE_OUTPUT_SCRIPT_LENGTH,
  inputToByteString,
  isTxHashEqual,
  locktimeToByteString,
  outputToByteString,
  splitHashFromStateOutput,
  versionToByteString,
} from '../lib/txTools'
import * as tools from 'uint8array-tools'
import { BatchId } from '../util/merkleUtils'
import { CONTRACT_INDEXES, getChangeOutput } from './util'


export type DepositAggregatorState = {
  type: 'LEAF',
  level: 0n,
  depositAmt: bigint;
  depositAddress: ByteString;
} | {
  type: 'INTERNAL',
  level: bigint,
  prevHashData0: Sha256;
  prevHashData1: Sha256;
}

export function stateToBatchID(
  state: DepositAggregatorState,
  prevTxid: string
): BatchId {
  const hash =
    state.type === 'LEAF'
      ? DepositAggregator.hashDepositData(
          state.depositAddress,
          state.depositAmt
        )
      : DepositAggregator.hashAggregatorData(
          state.level,
          state.prevHashData0,
          state.prevHashData1
        )
  /// add prevTxid to the hash to make it unique
  return sha256(prevTxid + hash)
}

export function stateHashToBatchID(
  stateHash: Sha256,
  prevTxid: string
): BatchId {
  return sha256(prevTxid + stateHash)
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
  static readonly LOCKED_ASM_VERSION = '7c5d2b5c86df5d3e886b048e1a51eec0'

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

  serializedState() {
    return DepositAggregatorCovenant.serializeState(this.state)
  }

  static serializeState(state: DepositAggregatorState) {
    if (state.type === 'LEAF') {
      return DepositAggregator.hashDepositData(
        state.depositAddress,
        state.depositAmt
      )
    } else {
      return DepositAggregator.hashAggregatorData(
        state.level,
        state.prevHashData0,
        state.prevHashData1
      )
    }
  }

  static parseDepositInfoFromTx(tx: Transaction): [isInitialDeposit: boolean, depositData: DepositData] {
    const [state] = splitHashFromStateOutput(tx)
    // 32[address] + 8[amount] = 40
    const isInitialDeposit = len(state) === 40n
    if (isInitialDeposit) {
      return [true, {
        address: state.slice(0, 64),
        amount: byteString2Int(state.slice(64)),
      }]
    } else {
      return [false, {
        address: '',
        amount: 0n,
      }]
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

    const outputContractSPK = tools.toHex(tx.outs[CONTRACT_INDEXES.outputIndex.depositAggregator].script)

    return {
      ver: versionToByteString(tx),
      inputContract0: level === 0n ? '' : inputToByteString(tx, 0),
      inputContract1: level === 0n ? '' : inputToByteString(tx, 1),
      inputFee:
        level === 0n ? inputToByteString(tx, 0) : inputToByteString(tx, 2),

      // the contract output is always the first output
      // the hash data output is always the second output
      // the change output is always the third output, if exists
      outputContractAmt: tx.outs[CONTRACT_INDEXES.outputIndex.depositAggregator].value,
      outputContractSPK,
      hashData: Sha256(splitHashFromStateOutput(tx)[0]),
      changeOutput: getChangeOutput(tx, [outputContractSPK]),
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
    if (this.state.type === 'LEAF') {
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
    const level = utxo.state.level;

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
        getTxId(prevTx.ins[CONTRACT_INDEXES.inputIndex.depositAggregator.inAggregateDepositTx.first])
      )
      const ancestorRawtx1 = await chainProvider.getRawTransaction(
        getTxId(prevTx.ins[CONTRACT_INDEXES.inputIndex.depositAggregator.inAggregateDepositTx.second])
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
      type: 'LEAF',
      level: 0n,
      depositAddress: toByteString(''),
      depositAmt: 0n,
    }
  }

  static createDepositState(
    depositAddress: ByteString,
    depositAmt: bigint
  ): DepositAggregatorState {
    return {
      type: 'LEAF',
      level: 0n,
      depositAddress,
      depositAmt,
    }
  }

  static createAggregateState(
    level: bigint,
    prevHashData0: Sha256,
    prevHashData1: Sha256
  ): DepositAggregatorState {
    return {
      type: 'INTERNAL',
      level,
      prevHashData0,
      prevHashData1,
    }
  }
}
