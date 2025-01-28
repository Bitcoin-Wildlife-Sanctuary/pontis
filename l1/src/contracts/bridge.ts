import {
  assert,
  hash256,
  method,
  sha256,
  SmartContract,
  toByteString,
  Sig,
  PubKey,
  prop,
  ByteString,
  Sha256,
  int2ByteString,
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'
import { AggregatorTransaction, AggregatorUtils } from './aggregatorUtils'
import { MerklePath, MerkleProof } from './merklePath'
import { GeneralUtils } from './generalUtils'

export type BridgeTransaction = {
  ver: ByteString // version of the transaction
  inputs: ByteString // inputLengh + all inputs of the transaction

  contractSPK: ByteString // the script pubkey of the bridge contract output
  expanderSPK: ByteString // the script pubkey of the expander contract output

  contractAmt: bigint // the amount of the bridge contract output
  expanderAmt: bigint // the amount of the expander contract output
  expanderStateHash: Sha256 // the state hash of the expander state output

  // bridge contract state
  batchesRoot: Sha256 // the hash of the batches, stored in OP_RETURN output
  depositAggregatorSPK: ByteString // Aggregator SPK's are separated from the script
  changeOutput: ByteString // the change output, optional, if exists.
  locktime: ByteString
}

export const MAX_NODES_AGGREGATED = 4
export const MAX_INPUTS = 6

export class Bridge extends SmartContract {
  // @prop()
  // outpoint: ByteString;

  @prop()
  operator: PubKey

  @prop()
  expanderSPK: ByteString

  constructor(operator: PubKey, expanderSPK: ByteString) {
    super(...arguments)
    this.operator = operator
    this.expanderSPK = expanderSPK
  }

  @method()
  public finalizeL1Deposit(
    shPreimage: SHPreimage,
    sigOperator: Sig,
    prevTx: BridgeTransaction, // Previous bridge update transaction.
    aggregatorTx: AggregatorTransaction, // Root aggregator transaction.
    isLevel0Aggregator: boolean,
    fundingPrevout: ByteString,

    batchProof: MerkleProof,

    changeOutput: ByteString
  ) {
    // Check sighash preimage.
    const s = SigHashUtils.checkSHPreimage(shPreimage)
    assert(this.checkSig(s, SigHashUtils.Gx))

    // Check operator sig.
    assert(this.checkSig(sigOperator, this.operator))

    // Construct prev txids.
    const prevTxId = Bridge.getTxId(prevTx, this.expanderSPK)
    const aggregatorTxId = AggregatorUtils.getTxId(
      aggregatorTx,
      isLevel0Aggregator
    )

    // Check this transaction unlocks specified outputs in the correct order.
    const hashPrevouts = Bridge.getHashDepositTxPrevouts(
      prevTxId,
      aggregatorTxId,
      fundingPrevout
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)

    // Make sure this is unlocked via first input.
    assert(shPreimage.inputNumber == toByteString('00000000'))

    // Check second input unlocks correct aggregator script.
    // todo: prevTx.depositAggregatorSPK can be forged
    assert(prevTx.depositAggregatorSPK == aggregatorTx.outputContractSPK)

    // Check that the previous leaf is null
    assert(
      MerklePath.calcMerkleRoot(MerklePath.NULL_NODE, batchProof) ==
        prevTx.batchesRoot
    )

    // Construct new batches root
    // todo: change txid => outpoint to  avoid replaying issue.
    const batchID = sha256(aggregatorTxId + aggregatorTx.hashData)
    const batchesRootNew: Sha256 = MerklePath.calcMerkleRoot(
      batchID,
      batchProof
    )

    // Create new contract output.
    // Add total amount deposited to the bridge output balance.
    const contractOut = GeneralUtils.getContractOutput(
      prevTx.contractAmt + aggregatorTx.outputContractAmt,
      prevTx.contractSPK
    )

    // Create state output with new state hash.
    const stateHash = Bridge.getStateHash(
      batchesRootNew,
      prevTx.depositAggregatorSPK
    )
    const contractStateOut = GeneralUtils.getStateOutput(stateHash)

    // Enforce outputs.
    const hashOutputs = sha256(contractOut + contractStateOut + changeOutput)
    assert(hashOutputs == shPreimage.hashOutputs)
  }

  @method()
  public finalizeL2Deposit(
    shPreimage: SHPreimage,
    sigOperator: Sig,
    prevTx: BridgeTransaction, // Previous bridge update transaction.
    fundingPrevout: ByteString,

    batchId: Sha256,
    batchProof: MerkleProof,

    changeOutput: ByteString
  ) {
    // finalizeDepositTx: bridgeInput + feeInput => bridgeOutput + stateOutput

    // Check sighash preimage.
    const s = SigHashUtils.checkSHPreimage(shPreimage)
    assert(this.checkSig(s, SigHashUtils.Gx))

    // Check operator sig.
    assert(this.checkSig(sigOperator, this.operator))

    // Construct prev txids.
    const prevTxId = Bridge.getTxId(prevTx, this.expanderSPK)

    // Check this transaction unlocks specified outputs in the correct order.
    const hashPrevouts = Bridge.getHashNonDepositTxPrevouts(
      prevTxId,
      fundingPrevout
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)

    // Make sure this is unlocked via first input.
    assert(shPreimage.inputNumber == toByteString('00000000'))

    // Check that the previous leaf
    assert(MerklePath.calcMerkleRoot(batchId, batchProof) == prevTx.batchesRoot)

    // Construct new batches root, delete the batch leaf
    const batchesRootNew: Sha256 = MerklePath.calcMerkleRoot(
      MerklePath.NULL_NODE,
      batchProof
    )

    // Create new contract output.
    // Substract total amount deposited of the bridge output balance.
    const contractOut = GeneralUtils.getContractOutput(
      prevTx.contractAmt,
      prevTx.contractSPK
    )

    // Create state output with new state hash.
    const stateHash = Bridge.getStateHash(
      batchesRootNew,
      prevTx.depositAggregatorSPK
    )
    const contractStateOut = GeneralUtils.getStateOutput(stateHash)

    // Enforce outputs.
    const hashOutputs = sha256(contractOut + contractStateOut + changeOutput)
    assert(hashOutputs == shPreimage.hashOutputs)
  }

  @method()
  public createWithdrawal(
    shPreimage: SHPreimage,
    sigOperator: Sig,
    prevTx: BridgeTransaction, // Previous bridge update transaction.
    fundingPrevout: ByteString,

    expanderRoot: Sha256,
    sumAmt: bigint,
    changeOutput: ByteString
  ) {
    // Check sighash preimage.
    const s = SigHashUtils.checkSHPreimage(shPreimage)
    assert(this.checkSig(s, SigHashUtils.Gx))

    // Check operator sig.
    assert(this.checkSig(sigOperator, this.operator))

    // Construct prev txids.
    const prevTxId = Bridge.getTxId(prevTx, this.expanderSPK)

    // Check this transaction unlocks specified outputs in the correct order.
    const hashPrevouts = Bridge.getHashNonDepositTxPrevouts(
      prevTxId,
      fundingPrevout
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)

    // Make sure this is unlocked via first input.
    assert(shPreimage.inputNumber == toByteString('00000000'))

    // Substract total amount withrawn of the bridge output balance.
    const contractOut = GeneralUtils.getContractOutput(
      prevTx.contractAmt - sumAmt,
      prevTx.contractSPK
    )

    // Create state output with new state hash.
    const bridgeStateHash = Bridge.getStateHash(
      prevTx.batchesRoot,
      prevTx.depositAggregatorSPK
    )
    const expanderStateHash = expanderRoot

    const bridgeStateOut = GeneralUtils.getStateOutput(bridgeStateHash)

    // Create an expander P2TR output which carries the total amount withrawn.
    const expanderOut = GeneralUtils.getContractOutput(sumAmt, this.expanderSPK)
    const expanderStateOut = GeneralUtils.getStateOutput(expanderStateHash)

    // Enforce outputs.
    const hashOutputs = sha256(
      contractOut +
        bridgeStateOut +
        expanderOut +
        expanderStateOut +
        changeOutput
    )
    assert(hashOutputs == shPreimage.hashOutputs)
  }

  @method()
  static getTxId(tx: BridgeTransaction, expanderSPK: ByteString): Sha256 {
    // deployContract: feeInput => bridgeOutput + stateOutput + changeOutput
    // finalizeL1Deposit  : bridgeInput + depositAggregatorInput => bridgeOutput + stateOutput + changeOutput
    // finalizeL2Deposit: bridgeInput + feeInput => bridgeOutput + stateOutput + changeOutput
    // withdrawTx: bridgeInput + feeInput => bridgeOutput + bridgeStateOutput + expanderOutput + expanderStateOutput + changeOutput
    let nOutputs: bigint = tx.expanderAmt == 0n ? 2n : 4n
    if (tx.changeOutput != toByteString('')) {
      nOutputs += 1n
    }
    const nOutputsByteString = int2ByteString(nOutputs, 1n)

    const stateHash = Bridge.getStateHash(
      tx.batchesRoot,
      tx.depositAggregatorSPK
    )

    let expanderOut = toByteString('')
    let expanderStateOut = toByteString('')
    if (tx.expanderAmt != 0n) {
      expanderOut = GeneralUtils.getContractOutput(
        tx.expanderAmt,
        tx.expanderSPK
      )
      assert(tx.expanderSPK == expanderSPK)
      expanderStateOut = GeneralUtils.getStateOutput(tx.expanderStateHash)
    }

    return hash256(
      tx.ver +
        tx.inputs +
        nOutputsByteString +
        GeneralUtils.getContractOutput(tx.contractAmt, tx.contractSPK) +
        GeneralUtils.getStateOutput(stateHash) +
        expanderOut +
        expanderStateOut +
        tx.changeOutput +
        tx.locktime
    )
  }

  @method()
  static getHashDepositTxPrevouts(
    prevStateTxId: Sha256,
    aggregatorTxId: Sha256,
    feePrevout: ByteString
  ): Sha256 {
    return sha256(
      prevStateTxId +
        toByteString('00000000') +
        aggregatorTxId +
        toByteString('00000000') +
        feePrevout
    )
  }

  @method()
  static getHashNonDepositTxPrevouts(
    prevStateTxId: Sha256,
    feePrevout: ByteString
  ): Sha256 {
    return sha256(prevStateTxId + toByteString('00000000') + feePrevout)
  }

  /**
   * Creates bridge state hash, stored in an OP_RETURN output.
   *
   * @param batchesRoot - Merkle root of bridges batches tree.
   * @param depositAggregatorSPK - Deposit aggregator SPK.
   * @returns
   */
  @method()
  static getStateHash(
    batchesRoot: Sha256,
    depositAggregatorSPK: ByteString
  ): Sha256 {
    return hash256(batchesRoot + depositAggregatorSPK)
  }
}
