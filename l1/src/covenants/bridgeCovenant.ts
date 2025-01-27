import { int2ByteString, PubKey, Sha256 } from 'scrypt-ts'
import { ByteString } from 'scrypt-ts'
import { Covenant } from '../lib/covenant'
import { SupportedNetwork } from '../lib/constants'
import { Bridge, BridgeTransaction } from '../contracts/bridge'
import { AggregatorTransaction } from '../contracts/aggregatorUtils'
import { BridgeUtxo, ChainProvider } from '../lib/provider'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import { createEmptySha256, inputToByteString, locktimeToByteString, outputToByteString, splitHashFromStateOutput, versionToByteString } from '../lib/txTools'
import { InputCtx, SubContractCall } from '../lib/extPsbt'
import { BatchMerkleTree, BridgeMerkle } from '../util/merkleUtils'


export type BridgeState = {
  batchesRoot: Sha256
  merkleTree: BatchMerkleTree
  depositAggregatorSPK: ByteString
}

export type InputTrace = {
  prevTx: BridgeTransaction
}

export interface TracedBridge {
  covenant: BridgeCovenant,
  trace: InputTrace
}

export interface TraceableBridgeUtxo extends BridgeUtxo {
  operator: PubKey,
  expanderSPK: ByteString
}

export class BridgeCovenant extends Covenant<BridgeState> {
  // locked bridge artifact md5 hash
  static readonly LOCKED_ASM_VERSION = 'f090e7f0ad9b82a93f5460f6345e1a17'

  constructor(
    readonly operator: PubKey,
    readonly expanderSPK: ByteString,
    state: BridgeState,
    network?: SupportedNetwork
  ) {
    super(
      [
        {
          contract: new Bridge(operator, expanderSPK),
        },
      ],
      {
        lockedAsmVersion: BridgeCovenant.LOCKED_ASM_VERSION,
        network: network,
      }
    )
    this.state = state
  }

  serializedState(): ByteString {
    return Bridge.getStateHash(
      this.state.batchesRoot,
      this.state.depositAggregatorSPK
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
    fundingPrevout: ByteString,
  ): SubContractCall {
    const proof = BridgeMerkle.getMerkleProof(this.state.merkleTree, replacedNodeIndex);
    const batchId = this.state.merkleTree[replacedNodeIndex];

    if (BridgeMerkle.calcMerkleRoot(this.state.merkleTree) !== this.state.batchesRoot) {
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
              publicKey: this.operator.toString()
            })
          },
          prevTx,
          fundingPrevout,

          batchId,
          proof,
          self.getChangeOutput(),
        ]
        return args;
      }
    }
    return subCall
  }

  createWithdrawal(
    inputIndex: number,
    inputCtxs: Map<number, InputCtx>,

    prevTx: BridgeTransaction,
    fundingPrevout: ByteString,

    expanderRoot: Sha256,
    sumAmt: bigint,
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
              publicKey: this.operator.toString()
            })
          },
          prevTx,
          fundingPrevout,

          expanderRoot,
          sumAmt,
          self.getChangeOutput(),
        ]
      }
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
    fundingPrevout: ByteString,
  ): SubContractCall {
    const proof = BridgeMerkle.getMerkleProof(this.state.merkleTree, replacedNodeIndex);

    if (BridgeMerkle.calcMerkleRoot(this.state.merkleTree) !== this.state.batchesRoot) {
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
              publicKey: this.operator.toString()
            })
          },
          prevTx,
          aggregatorTx,
          isLevel0Aggregator,
          fundingPrevout,
          proof,
          self.getChangeOutput(),
        ]
        return args;
      }
    }
    return subCall
  }

  static async backtrace(
    utxo: TraceableBridgeUtxo,
    chainProvider: ChainProvider
  ): Promise<TracedBridge> {
    const prevTxId = utxo.utxo.txId;
    const rawtx = await chainProvider.getRawTransaction(prevTxId)
    const tx = Transaction.fromHex(rawtx)
    const covenant = new BridgeCovenant(utxo.operator, utxo.expanderSPK, utxo.state)
    const contractSPK = covenant.lockingScriptHex

    // todo: verify utxo.state.batchesRoot from utxo.state.merkleTree

    if (utxo.utxo.script !== contractSPK) {
      throw new Error('Invalid bridge utxo')
    }

    // createWithdrawal: outs.length == 4/5, optional changeOutput
    // other: outs.length == 2/3, optional changeOutput
    const isPrevTxCreateWithdrawal = tx.outs.length === 4 || tx.outs.length === 5;
    let expanderAmt = 0n;
    let expanderStateHash: Sha256 = createEmptySha256()
    let expanderSPK = ''
    if (isPrevTxCreateWithdrawal) {
      // the 3rd output is expander output
      expanderAmt = tx.outs[2].value
      // the 4th output is expander state output
      expanderStateHash = Sha256(splitHashFromStateOutput(tx, 3))
      expanderSPK = utxo.expanderSPK;
    }
    let changeOutput: ByteString = ''
    const hasChangeOutput = isPrevTxCreateWithdrawal ? tx.outs.length === 5 : tx.outs.length === 3;
    if (hasChangeOutput) {
      changeOutput = outputToByteString(tx, tx.outs.length - 1)
    }

    const prevTx: BridgeTransaction = {
      ver: versionToByteString(tx),
      inputs: int2ByteString(BigInt(tx.ins.length), 1n) + tx.ins.map((_, inputIndex) => inputToByteString(tx, inputIndex)).reduce((prev, cur) => prev + cur, ''),

      contractSPK,
      contractAmt: tx.outs[0].value,
      expanderSPK,
      expanderAmt,
      expanderStateHash,

      batchesRoot: utxo.state.batchesRoot,
      depositAggregatorSPK: utxo.state.depositAggregatorSPK,
      changeOutput,
      locktime: locktimeToByteString(tx),
    }
    return {
      covenant,
      trace: {
        prevTx,
      }
    }
  }
}
