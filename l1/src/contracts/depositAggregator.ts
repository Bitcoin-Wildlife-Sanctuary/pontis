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
  len,
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'
import { AggregatorTransaction, AggregatorUtils } from './aggregatorUtils'
import { GeneralUtils } from './generalUtils'
import { SpentSPKs, TxUtils } from './txUtil'
import { MerklePath } from './merklePath'

export type DepositData = {
  // todo: confirm address length? 32 bytes?
  address: ByteString
  amount: bigint
}

export class DepositAggregator extends SmartContract {
  @prop()
  operator: PubKey

  @prop()
  bridgeSPK: ByteString

  /**
   * Covenant used for the aggregation of deposits.
   *
   * @param operator - Public key of bridge operator.
   * @param bridgeSPK - P2TR script of the bridge state covenant. Includes length prefix!
   */
  constructor(operator: PubKey, bridgeSPK: ByteString) {
    super(...arguments)
    this.operator = operator
    this.bridgeSPK = bridgeSPK
  }

  /**
   * Aggregates two aggregator transactions (or leaves) into one.
   *
   * @param shPreimage - Sighash preimage of the currently executing transaction.
   * @param sigOperator - Signature of the bridge operator.
   * @param level - the level of the aggregation; zero is the first level, which is the leaf level
   * @param prevTx0 - Transaction data of the first previous transaction being aggregated. Can be a leaf transaction containing the deposit request itself or an already aggregated transaction.
   * @param prevTx1 - Transaction data of the second previous transaction being aggregated.
   * @param ancestorTx0 - First ancestor transaction. These are used to inductively verify the transaction history; ignored when aggregating leaves.
   * @param ancestorTx1 - Second ancestor transaction.
   * @param ancestorTx2 - Third ancestor transaction.
   * @param ancestorTx3 - Fourth ancestor transaction.
   * @param isAncestorLeaf - Indicates whether the ancestor transactions are leaves.
   * @param fundingPrevout - The prevout for the funding UTXO.
   * @param isFirstInput - Indicates whether this method is called from the first or second input.
   * @param depositData0 - Actual deposit data of the first deposit; used when aggregating leaves.
   * @param depositData1 - Actual deposit data of the second deposit; used when aggregating leaves.
   */
  @method()
  public aggregate(
    shPreimage: SHPreimage,
    sigOperator: Sig,
    level: bigint,
    prevTx0: AggregatorTransaction,
    prevTx1: AggregatorTransaction,
    ancestorTx0: AggregatorTransaction,
    ancestorTx1: AggregatorTransaction,
    ancestorTx2: AggregatorTransaction,
    ancestorTx3: AggregatorTransaction,
    fundingPrevout: ByteString,
    isFirstInput: boolean,
    depositData0: DepositData,
    depositData1: DepositData,
    changeOutput: ByteString
  ) {
    // Check sighash preimage.
    const s = SigHashUtils.checkSHPreimage(shPreimage)
    assert(this.checkSig(s, SigHashUtils.Gx))

    // Check operator sig.
    assert(this.checkSig(sigOperator, this.operator))

    // check level is valid, 1 bytes for uint8, first bit is always 0
    MerklePath.checkLevelValid(level)

    // Construct prev tx IDs.
    const prevTxId0 = AggregatorUtils.getTxId(prevTx0, level == 0n)
    const prevTxId1 = AggregatorUtils.getTxId(prevTx1, level == 0n)

    // Check passed prev txns are actually unlocked by the currently executing tx.
    const hashPrevouts = AggregatorUtils.getHashPrevouts(
      prevTxId0,
      prevTxId1,
      fundingPrevout
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)

    // Check prev txns SPK match.
    assert(prevTx0.outputContractSPK == prevTx1.outputContractSPK)

    // Check isFirstInput flag is valid.
    if (isFirstInput) {
      assert(shPreimage.inputNumber == toByteString('00000000'))
    } else {
      assert(shPreimage.inputNumber == toByteString('01000000'))
    }

    if (level == 0n) {
      // If prev txns are leaves, check that the hash in their state
      // OP_RETURN output corresponds to the data passed in as witnesses.

      // todo: confirm address length? 32 bytes?
      assert(len(depositData0.address) == 32n)
      assert(len(depositData1.address) == 32n)
      const hashData0 = DepositAggregator.hashDepositData(
        level,
        depositData0.address,
        depositData0.amount
      )
      const hashData1 = DepositAggregator.hashDepositData(
        level,
        depositData1.address,
        depositData1.amount
      )

      assert(depositData0.amount == prevTx0.outputContractAmt)
      assert(depositData1.amount == prevTx1.outputContractAmt)
      assert(hashData0 == prevTx0.hashData)
      assert(hashData1 == prevTx1.hashData)
    } else {
      // If we're higher up the aggregation tree, we need to check ancestor
      // transactions in order to inductively validate the whole tree.
      const ancestorTxId0 = AggregatorUtils.getTxId(ancestorTx0, level == 1n)
      const ancestorTxId1 = AggregatorUtils.getTxId(ancestorTx1, level == 1n)
      const ancestorTxId2 = AggregatorUtils.getTxId(ancestorTx2, level == 1n)
      const ancestorTxId3 = AggregatorUtils.getTxId(ancestorTx3, level == 1n)

      // Check prevTx0 unlocks ancestorTx0 and ancestorTx1.
      // Input structure: ancestorTxId + output index (0000000000) + nSequence (ffffffff)
      assert(
        prevTx0.inputContract0 ==
        ancestorTxId0 + toByteString('0000000000ffffffff')
      )
      assert(
        prevTx0.inputContract1 ==
        ancestorTxId1 + toByteString('0000000000ffffffff')
      )

      // Check prevTx1 unlocks ancestorTx2 and ancestorTx3.
      assert(
        prevTx1.inputContract0 ==
        ancestorTxId2 + toByteString('0000000000ffffffff')
      )
      assert(
        prevTx1.inputContract1 ==
        ancestorTxId3 + toByteString('0000000000ffffffff')
      )

      // Check ancestors have same contract SPK as prev txns.
      // This completes the inductive step, since the successfull evaluation
      // of the ancestors contract SPK also checked its ancestors.
      assert(prevTx0.outputContractSPK == ancestorTx0.outputContractSPK)
      assert(prevTx0.outputContractSPK == ancestorTx1.outputContractSPK)
      assert(prevTx0.outputContractSPK == ancestorTx2.outputContractSPK)
      assert(prevTx0.outputContractSPK == ancestorTx3.outputContractSPK)

      const hashData0 = DepositAggregator.hashAggregatedDepositData(
        level,
        ancestorTx0.hashData,
        ancestorTx1.hashData
      )
      const hashData1 = DepositAggregator.hashAggregatedDepositData(
        level,
        ancestorTx2.hashData,
        ancestorTx3.hashData
      )

      assert(hashData0 == prevTx0.hashData)
      assert(hashData1 == prevTx1.hashData)
    }

    // Concatinate hashes from previous aggregation txns (or leaves)
    // and compute new hash. Store this new hash in the state OP_RETURN
    // output.
    const newHash = DepositAggregator.hashAggregatedDepositData(
      level + 1n,
      prevTx0.hashData,
      prevTx1.hashData
    )
    const stateOut = GeneralUtils.getStateOutput(newHash)

    // Sum up aggregated amounts and construct contract output.
    // todo: change herer;
    const contractOut = GeneralUtils.getContractOutput(
      prevTx0.outputContractAmt + prevTx1.outputContractAmt,
      prevTx0.outputContractSPK
    )

    // Recurse. Send to aggregator with updated hash.
    const outputs = contractOut + stateOut + changeOutput
    assert(sha256(outputs) == shPreimage.hashOutputs)
  }

  /**
   * Finalizes the aggregation process by merging the aggregation result into the bridge covenant.
   *
   * @param shPreimage - Sighash preimage of the currently executing transaction.
   * @param sigOperator - Signature of the bridge operator.
   * @param prevTx - The previous aggregator transaction.
   * @param ancestorTx0 - First ancestor transaction. These are used to inductively verify the transaction history.
   * @param ancestorTx1 - Second ancestor transaction.
   * @param bridgeTxId - TXID of the latest bridge instance.
   * @param fundingPrevout - Prevout of funding UTXO.
   */
  @method()
  public finalizeL1(
    shPreimage: SHPreimage,
    sigOperator: Sig,
    prevTx: AggregatorTransaction,
    prevTxLevel: bigint,
    ancestorTx0: AggregatorTransaction,
    ancestorTx1: AggregatorTransaction,
    bridgeTxId: Sha256,
    spentSPKs: SpentSPKs,
    fundingPrevout: ByteString
  ) {
    // Check sighash preimage.
    const s = SigHashUtils.checkSHPreimage(shPreimage)
    assert(this.checkSig(s, SigHashUtils.Gx))

    // Check operator sig.
    assert(this.checkSig(sigOperator, this.operator))

    // Construct prev TX ID.
    const prevTxId = AggregatorUtils.getTxId(prevTx, prevTxLevel === 0n)

    // Check this transaction unlocks specified outputs in the correct order.
    const hashPrevouts = AggregatorUtils.getHashPrevouts(
      bridgeTxId,
      prevTxId,
      fundingPrevout
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)

    // check bridgeSPK is valid
    assert(TxUtils.checkSpentScripts(spentSPKs, shPreimage.hashSpentScripts))
    assert(spentSPKs[0] == this.bridgeSPK)

    // Make sure this is unlocked via second input.
    assert(shPreimage.inputNumber == toByteString('01000000'))

    if (prevTxLevel !== 0n) {
      // Construct ancestor TX IDs.
      const ancestorTxId0 = AggregatorUtils.getTxId(ancestorTx0, prevTxLevel === 1n)
      const ancestorTxId1 = AggregatorUtils.getTxId(ancestorTx1, prevTxLevel === 1n)

      // Check prevTx unlocks ancestorTx0 and ancestorTx1.
      assert(
        prevTx.inputContract0 ==
        ancestorTxId0 + toByteString('0000000000ffffffff')
      )
      assert(
        prevTx.inputContract1 ==
        ancestorTxId1 + toByteString('0000000000ffffffff')
      )

      // Check ancestors have same contract SPK as prev tx.
      assert(prevTx.outputContractSPK == ancestorTx0.outputContractSPK)
      assert(prevTx.outputContractSPK == ancestorTx1.outputContractSPK)
    }
    assert(true);
  }

  @method()
  static hashDepositData(
    level: bigint,
    depositAddress: ByteString,
    depositAmt: bigint
  ): Sha256 {
    return hash256(
      MerklePath.levelToByteString(level) +
      sha256(depositAddress + GeneralUtils.padAmt(depositAmt))
    )
  }

  @method()
  static hashAggregatedDepositData(
    level: bigint,
    left: Sha256,
    right: Sha256
  ): Sha256 {
    return hash256(MerklePath.levelToByteString(level) + left + right)
  }
}
