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
import { InputsSegments, TxUtils } from './txUtil'

/**
 * Using the BridgeTransaction type, you can construct a * bridge bitcoin transaction hash.
 * for how to build a BridgeTransaction from a bridge transaction, please refer to the BridgeCovenant.backtrace
 */
export type BridgeTransaction = {
  /**
   * The version of the transaction.
   * currently, ther version is always 2, in ByteString format 0x02000000.
   */
  ver: ByteString
  /**
   * The inputs of the transaction. Split into segments due to the max variable size of bvm.
   */
  inputs: InputsSegments
  /**
   * The script pubkey of the bridge contract output
   */
  contractSPK: ByteString
  /**
   * The script pubkey of the expander contract output
   */
  expanderSPK: ByteString
  /**
   * The amount of the bridge contract output
   */
  contractAmt: bigint
  /**
   * The amount of the expander contract output
   */
  expanderAmt: bigint
  /**
   * The state hash of the expander state output
   */
  expanderStateHash: Sha256
  /**
   * The merkle root of the batches, used for calculating the bridge state hash
   */
  batchesRoot: Sha256
  /**
   * The script pubkey of the deposit aggregator contract output
   */
  depositAggregatorSPK: ByteString
  /**
   * The change output, optional, if exists.
   */
  changeOutput: ByteString
  /**
   * The locktime of the transaction
   */
  locktime: ByteString
}

export class Bridge extends SmartContract {
  /**
   * The operator pubkey
   * @dev-note: the pubkey is xonly
   */
  @prop()
  operator: PubKey

  /**
   * The script pubkey of the withdrawalExpander contract output
   */
  @prop()
  expanderSPK: ByteString

  /**
   * Constructor
   * @param operator - The operator pubkey
   * @param expanderSPK - The script pubkey of the expander contract output
   */
  constructor(operator: PubKey, expanderSPK: ByteString) {
    super(...arguments)
    this.operator = operator
    this.expanderSPK = expanderSPK
  }

  /**
   * Finalize the L1 deposit.
   * used when the aggregations are done, and the satoshis of the aggregator utxo should be merged into the bridge utxo.
   *
   * tx: bridgeInput + aggregatorInput + feeInput => stateOutput + bridgeOutput + changeOutput(optional)
   *
   * @param shPreimage - The sighash preimage.
   * @param sigOperator - The operator signature.
   * @param prevTx - The previous bridge transaction.
   * @param aggregatorTx - The previous aggregator transaction.
   * @param isLevel0Aggregator - Whether the aggregator is a level 0 aggregator.
   * @param feePrevout - The fee input.
   * @param batchProof - The batch proof.
   * @param changeOutput - The change output.
   */
  @method()
  public finalizeL1Deposit(
    shPreimage: SHPreimage,
    sigOperator: Sig,
    prevTx: BridgeTransaction,
    aggregatorTx: AggregatorTransaction,
    isLevel0Aggregator: boolean,
    feePrevout: ByteString,

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
    const hashPrevouts = Bridge.getFinalizeL1PrevoutsHash(
      prevTxId,
      aggregatorTxId,
      feePrevout
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
    // optimize: change txid => outpoint to  avoid replaying issue. currently the index of aggregator outpoint is always 0, which is verified in Bridge.
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
    const stateOut = GeneralUtils.getStateOutput(stateHash, toByteString(''))

    // Enforce outputs.
    const hashOutputs = sha256(stateOut + contractOut + changeOutput)
    assert(hashOutputs == shPreimage.hashOutputs)
  }

  /**
   * Finalize the L2 deposit.
   * used when the operator has sent the bitocin to the deposit addresses on l2 for a deposit batch. So the operator notify the bridge contract on L1 that the deposit batch is done.
   *
   * tx: bridgeInput + feeInput => stateOutput + bridgeOutput + changeOutput(optional)
   *
   * @param shPreimage - The sighash preimage.
   * @param sigOperator - The operator signature.
   * @param prevTx - The previous bridge transaction.
   * @param feePrevout - The fee prevout of current transaction.
   * @param batchId - The batch id. Generated on finalizeL1Deposit.
   * @param batchProof - The batch proof.
   * @param changeOutput - The change output of current transaction.
   */
  @method()
  public finalizeL2Deposit(
    shPreimage: SHPreimage,
    sigOperator: Sig,
    prevTx: BridgeTransaction, // Previous bridge update transaction.
    feePrevout: ByteString,

    batchId: Sha256,
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

    // Check this transaction unlocks specified outputs in the correct order.
    const hashPrevouts = Bridge.getNonFinalizeL1PrevoutsHash(
      prevTxId,
      feePrevout
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
    const stateOut = GeneralUtils.getStateOutput(stateHash, toByteString(''))

    // Enforce outputs.
    const hashOutputs = sha256(stateOut + contractOut + changeOutput)
    assert(hashOutputs == shPreimage.hashOutputs)
  }

  /**
   * Create a withdrawal transaction.
   *
   * Used when the users want to withdraw from L2 to L1.
   * The users request their withdrawals on L2, the operator collects the withdrawals.
   * Then call this function to create a withdrawalExpander utxo on L1 to start the L1 withdrawal process.
   *
   * tx: bridgeInput + feeInput => stateOutput + bridgeOutput + expanderOutput + changeOutput(optional)
   *
   * @param shPreimage - The sighash preimage.
   * @param sigOperator - The operator signature.
   * @param prevTx - The previous bridge transaction.
   * @param feePrevout - The fee prevout of current transaction.
   * @param expanderRoot - The root of the expander merkle tree.
   * @param sumAmt - The total amount to withdraw.
   * @param changeOutput - The change output of current transaction.
   */
  @method()
  public createWithdrawal(
    shPreimage: SHPreimage,
    sigOperator: Sig,
    prevTx: BridgeTransaction, // Previous bridge update transaction.
    feePrevout: ByteString,

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
    const hashPrevouts = Bridge.getNonFinalizeL1PrevoutsHash(
      prevTxId,
      feePrevout
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
    // Create an expander P2TR output which carries the total amount withrawn.
    const expanderOut = GeneralUtils.getContractOutput(sumAmt, this.expanderSPK)

    const stateOut = GeneralUtils.getStateOutput(
      bridgeStateHash,
      expanderStateHash
    )

    // Enforce outputs.
    const hashOutputs = sha256(
      stateOut + contractOut + expanderOut + changeOutput
    )
    assert(hashOutputs == shPreimage.hashOutputs)
  }

  /**
   * Get the txid of the bridge transaction.
   *
   * deployBridgeContract tx:
   * feeInput => stateOutput + bridgeOutput + changeOutput(optional)
   *
   * finalizeL1Deposit  tx:
   * bridgeInput + depositAggregatorInput + feeInput => stateOutput + bridgeOutput + changeOutput(optional)
   *
   * finalizeL2Deposit tx:
   * bridgeInput + feeInput => stateOutput + bridgeOutput + changeOutput(optional)
   *
   * createWithdrawal tx:
   * bridgeInput + feeInput => stateOutput + bridgeOutput + expanderOutput + changeOutput(optional)
   *
   * @param tx - The bridge transaction.
   * @param expanderSPK - The script pubkey of the expander contract output.
   * @returns The txid of the bridge transaction.
   */
  @method()
  static getTxId(tx: BridgeTransaction, expanderSPK: ByteString): Sha256 {
    // if the expander amount is 0, it's not a createWithdrawal tx.
    let nOutputs: bigint = tx.expanderAmt == 0n ? 2n : 3n
    // if the change output is not empty, add 1 to the number of outputs
    if (tx.changeOutput != toByteString('')) {
      nOutputs += 1n
    }
    const nOutputsByteString = int2ByteString(nOutputs)

    const bridgeStateHash = Bridge.getStateHash(
      tx.batchesRoot,
      tx.depositAggregatorSPK
    )

    let expanderOut = toByteString('')
    // if the expander amount is not 0, there is an expander output
    if (tx.expanderAmt != 0n) {
      expanderOut = GeneralUtils.getContractOutput(
        tx.expanderAmt,
        tx.expanderSPK
      )
      assert(tx.expanderSPK == expanderSPK)
    }

    return hash256(
      tx.ver +
        TxUtils.mergeInputsSegments(tx.inputs) +
        nOutputsByteString +
        GeneralUtils.getStateOutput(bridgeStateHash, tx.expanderStateHash) +
        GeneralUtils.getContractOutput(tx.contractAmt, tx.contractSPK) +
        expanderOut +
        tx.changeOutput +
        tx.locktime
    )
  }

  /**
   * Get the hash of the finalizeL1Deposit transaction prevouts.
   *
   * @param prevTxId - The previous transaction id.
   * @param aggregatorTxId - The aggregator transaction id.
   * @param feePrevout - The fee prevout.
   * @returns The hash of the finalizeL1Deposit transaction prevouts.
   */
  @method()
  static getFinalizeL1PrevoutsHash(
    prevTxId: Sha256,
    aggregatorTxId: Sha256,
    feePrevout: ByteString
  ): Sha256 {
    return sha256(
      prevTxId +
        toByteString('01000000') +
        aggregatorTxId +
        toByteString('01000000') +
        feePrevout
    )
  }

  /**
   * Get the hash of the non-finalizeL1Deposit transaction prevouts.
   *
   * @param prevTxId - The previous transaction id.
   * @param feePrevout - The fee prevout.
   * @returns The hash of the non-finalizeL1Deposit transaction prevouts.
   */
  @method()
  static getNonFinalizeL1PrevoutsHash(
    prevTxId: Sha256,
    feePrevout: ByteString
  ): Sha256 {
    return sha256(prevTxId + toByteString('01000000') + feePrevout)
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
