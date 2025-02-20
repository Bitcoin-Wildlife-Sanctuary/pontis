import { PubKey, Sha256 } from 'scrypt-ts'
import { ByteString } from 'scrypt-ts'
import { Covenant } from '../lib/covenant'
import { SupportedNetwork } from '../lib/constants'
import { Bridge, BridgeTransaction } from '../contracts/bridge'
import { AggregatorTransaction } from '../contracts/aggregatorUtils'
import { BridgeUtxo, ChainProvider } from '../lib/provider'
import {
  createEmptySha256,
  inputsToSegmentByteString,
  isTxHashEqual,
  locktimeToByteString,
  outputToByteString,
  splitHashFromStateOutput,
  TWO_STATE_OUTPUT_SCRIPT_LENGTH,
  versionToByteString,
} from '../lib/txTools'
import { InputCtx, SubContractCall } from '../lib/extPsbt'
import { BatchMerkleTree, BridgeMerkle } from '../util/merkleUtils'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import { toXOnly } from '../lib/utils'
import { MerklePath } from '../contracts/merklePath'
import { CONTRACT_INDEXES, getChangeOutput } from './util'
export type BridgeState = {
  batchesRoot: Sha256
  merkleTree: BatchMerkleTree
  depositAggregatorSPK: ByteString
}

export type InputTrace = {
  prevTx: BridgeTransaction
}

export interface TracedBridge {
  covenant: BridgeCovenant
  trace: InputTrace
}

export interface TraceableBridgeUtxo extends BridgeUtxo {
  operator: PubKey
  expanderSPK: ByteString
}

export class BridgeCovenant extends Covenant<BridgeState> {
  // locked bridge artifact md5 hash
  static readonly LOCKED_ASM_VERSION = '9516f2a53fe909977084f37b9143d1ac'

  static readonly EMPTY_BATCH_ID = MerklePath.NULL_NODE

  constructor(
    readonly operator: PubKey,
    readonly expanderSPK: ByteString,
    state: BridgeState,
    network?: SupportedNetwork
  ) {
    super(
      [
        {
          // todo: confirm address type
          contract: new Bridge(PubKey(toXOnly(operator, true)), expanderSPK),
          // contract: new Bridge(operator, expanderSPK),
        },
      ],
      {
        lockedAsmVersion: BridgeCovenant.LOCKED_ASM_VERSION,
        network: network,
      }
    )
    this.state = state
  }

  serializedState() {
    return BridgeCovenant.serializeState(this.state)
  }

  static serializeState(state: BridgeState) {
    return Bridge.getStateHash(
      state.batchesRoot,
      state.depositAggregatorSPK
    )
  }

  static createEmptyState(depositAggregatorSPK: ByteString): BridgeState {
    const tree = BridgeMerkle.getEmptyTree()
    const merkleRoot = BridgeMerkle.getEmptyMerkleRoot()
    return {
      merkleTree: tree,
      batchesRoot: merkleRoot,
      depositAggregatorSPK,
    }
  }

  finalizeL2Deposit(
    inputIndex: number,
    inputCtxs: Map<number, InputCtx>,

    replacedNodeIndex: number,

    prevTx: BridgeTransaction,
    fundingPrevout: ByteString
  ): SubContractCall {
    const proof = BridgeMerkle.getMerkleProof(
      this.state.merkleTree,
      replacedNodeIndex
    )
    const batchId = this.state.merkleTree[replacedNodeIndex]

    if (
      BridgeMerkle.calcMerkleRoot(this.state.merkleTree) !==
      this.state.batchesRoot
    ) {
      throw new Error('Invalid merkle tree')
    }

    const subCall: SubContractCall = {
      method: 'finalizeL2Deposit',
      argsBuilder: (self, _tapLeafContract) => {
        const { shPreimage } = inputCtxs.get(inputIndex)
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
          fundingPrevout,

          batchId,
          proof,
          self.getChangeOutput(),
        ]
        return args
      },
    }
    return subCall
  }

  createWithdrawal(
    inputIndex: number,
    inputCtxs: Map<number, InputCtx>,

    prevTx: BridgeTransaction,
    fundingPrevout: ByteString,

    expanderRoot: Sha256,
    sumAmt: bigint
  ): SubContractCall {
    const subCall: SubContractCall = {
      method: 'createWithdrawal',
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
          prevTx,
          fundingPrevout,

          expanderRoot,
          sumAmt,
          self.getChangeOutput(),
        ]
      },
    }
    return subCall
  }

  finalizeL1Deposit(
    inputIndex: number,
    inputCtxs: Map<number, InputCtx>,

    replacedNodeIndex: number,

    prevTx: BridgeTransaction,
    aggregatorTx: AggregatorTransaction,
    isLevel0Aggregator: boolean,
    fundingPrevout: ByteString
  ): SubContractCall {
    const proof = BridgeMerkle.getMerkleProof(
      this.state.merkleTree,
      replacedNodeIndex
    )

    if (
      BridgeMerkle.calcMerkleRoot(this.state.merkleTree) !==
      this.state.batchesRoot
    ) {
      throw new Error('Invalid merkle tree')
    }

    const subCall: SubContractCall = {
      method: 'finalizeL1Deposit',
      argsBuilder: (self, _tapLeafContract) => {
        const { shPreimage } = inputCtxs.get(inputIndex)
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
          aggregatorTx,
          isLevel0Aggregator,
          fundingPrevout,
          proof,
          self.getChangeOutput(),
        ]
        return args
      },
    }
    return subCall
  }

  static async backtrace(
    utxo: TraceableBridgeUtxo,
    chainProvider: ChainProvider
  ): Promise<TracedBridge> {
    const prevTxId = utxo.utxo.txId
    const rawtx = await chainProvider.getRawTransaction(prevTxId)
    const tx = Transaction.fromHex(rawtx)
    const covenant = new BridgeCovenant(
      utxo.operator,
      utxo.expanderSPK,
      utxo.state
    )
    const contractSPK = covenant.lockingScriptHex

    // todo: verify utxo.state.batchesRoot from utxo.state.merkleTree

    if (utxo.utxo.script !== contractSPK) {
      throw new Error('Invalid bridge utxo')
    }

    // ref in Bridge.getTxId
    let expanderAmt = 0n
    let expanderStateHash: Sha256 = createEmptySha256()
    let expanderSPK = ''
    const isPrevTxCreateWithdrawal =
      tx.outs[0].script.length === TWO_STATE_OUTPUT_SCRIPT_LENGTH
    if (isPrevTxCreateWithdrawal) {
      // the 3rd output is expander output
      expanderAmt = tx.outs[2].value
      // the 4th output is expander state output
      expanderStateHash = Sha256(splitHashFromStateOutput(tx)[1])
      expanderSPK = utxo.expanderSPK
    }
    let changeOutput: ByteString = getChangeOutput(tx, [contractSPK, expanderSPK])

    const prevTx: BridgeTransaction = {
      ver: versionToByteString(tx),
      inputs: inputsToSegmentByteString(tx),

      contractSPK,
      contractAmt: tx.outs[CONTRACT_INDEXES.outputIndex.bridge].value,
      expanderSPK,
      expanderAmt,
      expanderStateHash,

      batchesRoot: utxo.state.batchesRoot,
      depositAggregatorSPK: utxo.state.depositAggregatorSPK,
      changeOutput,
      locktime: locktimeToByteString(tx),
    }
    if (!isTxHashEqual(tx, Bridge.getTxId(prevTx, expanderSPK))) {
      throw new Error('prevTx txid mismatch')
    }
    return {
      covenant,
      trace: {
        prevTx,
      },
    }
  }
}
