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

/**
 * The data of the deposit.
 */
export type DepositData = {
  /**
   * The L2 address of the deposit.
   */
  address: ByteString
  /**
   * The amount/satoshis of the deposit.
   */
  amount: bigint
}

export class DepositAggregator extends SmartContract {
  /**
   * The operator of the deposit aggregator.
   * @dev-note: the pubkey is xonly
   */
  @prop()
  operator: PubKey

  /**
   * The script pubkey of the bridge contract output.
   */
  @prop()
  bridgeSPK: ByteString

  /**
   * Constructor
   * Used to create a deposit aggregator contract. which means the user start to deposit from L1 to L2.
   * @param operator - The operator of the deposit aggregator.
   * @param bridgeSPK - The script pubkey of the bridge contract output.
   */
  constructor(operator: PubKey, bridgeSPK: ByteString) {
    super(...arguments)
    this.operator = operator
    this.bridgeSPK = bridgeSPK
  }

  /**
   * Aggregates two aggregator utxos into one.
   * 
   * tx: aggregatorInput0 + aggregatorInput1 + feeInput => stateOutput + aggregatorOutput + changeOutput(optional)
   * 
   * @param shPreimage - The sighash preimage of the currently executing transaction.
   * @param sigOperator - The signature of the bridge operator.
   * @param level - The level of the aggregation; zero is the first level, which is the leaf level
   * @param prevTx0 - The previous transaction of the first input
   * @param prevTx1 - The previous transaction of the second input
   * @param ancestorTx0 - The previous transaction of first input of prevTx0
   * @param ancestorTx1 - The previous transaction of second input of prevTx0
   * @param ancestorTx2 - The previous transaction of first input of prevTx1
   * @param ancestorTx3 - The previous transaction of second input of prevTx1
   * @param feePrevout - The prevout of the fee input
   * @param isFirstInput - Indicates whether this method is called from the first or second input.
   * 
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
    feePrevout: ByteString,
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
      feePrevout
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

      const hashData0 = DepositAggregator.hashDepositData(
        depositData0.address,
        depositData0.amount
      )
      const hashData1 = DepositAggregator.hashDepositData(
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
          ancestorTxId0 + toByteString('0100000000ffffffff')
      )
      assert(
        prevTx0.inputContract1 ==
          ancestorTxId1 + toByteString('0100000000ffffffff')
      )

      // Check prevTx1 unlocks ancestorTx2 and ancestorTx3.
      assert(
        prevTx1.inputContract0 ==
          ancestorTxId2 + toByteString('0100000000ffffffff')
      )
      assert(
        prevTx1.inputContract1 ==
          ancestorTxId3 + toByteString('0100000000ffffffff')
      )

      // Check ancestors have same contract SPK as prev txns.
      // This completes the inductive step, since the successfull evaluation
      // of the ancestors contract SPK also checked its ancestors.
      assert(prevTx0.outputContractSPK == ancestorTx0.outputContractSPK)
      assert(prevTx0.outputContractSPK == ancestorTx1.outputContractSPK)
      assert(prevTx0.outputContractSPK == ancestorTx2.outputContractSPK)
      assert(prevTx0.outputContractSPK == ancestorTx3.outputContractSPK)

      const hashData0 = DepositAggregator.hashAggregatorData(
        level,
        ancestorTx0.hashData,
        ancestorTx1.hashData
      )
      const hashData1 = DepositAggregator.hashAggregatorData(
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
    const newHash = DepositAggregator.hashAggregatorData(
      level + 1n,
      prevTx0.hashData,
      prevTx1.hashData
    )
    const stateOut = GeneralUtils.getStateOutput(newHash, toByteString(''))

    // Sum up aggregated amounts and construct contract output.
    const contractOut = GeneralUtils.getContractOutput(
      prevTx0.outputContractAmt + prevTx1.outputContractAmt,
      prevTx0.outputContractSPK
    )

    // Recurse. Send to aggregator with updated hash.
    const outputs = stateOut + contractOut + changeOutput
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
   * @param feePrevout - Prevout of fee UTXO.
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
    feePrevout: ByteString
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
      feePrevout
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)

    // check bridgeSPK is valid
    TxUtils.checkSpentScripts(spentSPKs, shPreimage.hashSpentScripts)
    assert(spentSPKs[0] == this.bridgeSPK)

    // Make sure this is unlocked via second input.
    assert(shPreimage.inputNumber == toByteString('01000000'))

    if (prevTxLevel !== 0n) {
      // Construct ancestor TX IDs.
      const ancestorTxId0 = AggregatorUtils.getTxId(
        ancestorTx0,
        prevTxLevel === 1n
      )
      const ancestorTxId1 = AggregatorUtils.getTxId(
        ancestorTx1,
        prevTxLevel === 1n
      )

      // Check prevTx unlocks ancestorTx0 and ancestorTx1.
      assert(
        prevTx.inputContract0 ==
          ancestorTxId0 + toByteString('0100000000ffffffff')
      )
      assert(
        prevTx.inputContract1 ==
          ancestorTxId1 + toByteString('0100000000ffffffff')
      )

      // Check ancestors have same contract SPK as prev tx.
      assert(prevTx.outputContractSPK == ancestorTx0.outputContractSPK)
      assert(prevTx.outputContractSPK == ancestorTx1.outputContractSPK)
    }
    assert(true)
  }

  /**
   * Hash the deposit data. 
   * For depositData, we store the plain data, not hashed.
   * @param depositAddress - The L2 address of the deposit.
   * @param depositAmt - The amount of the deposit.
   * @returns The hash of the deposit data.
   */
  @method()
  static hashDepositData(
    depositAddress: ByteString,
    depositAmt: bigint
  ): ByteString {
    // for depositData, we store the plain data, not hashed.
    assert(len(depositAddress) == GeneralUtils.L2_ADDRESS_LENGTH)
    return depositAddress + GeneralUtils.padAmt(depositAmt)
  }

  /**
   * Hash the aggregated deposit data.
   * for aggregatorData, we store the hash of the data, not the plain data.
   * @param level - The level of the aggregation.
   * @param left - The left hash of the aggregated deposit data.
   * @param right - The right hash of the aggregated deposit data.
   * @returns The hash of the aggregated deposit data.
   */
  @method()
  static hashAggregatorData(
    level: bigint,
    left: ByteString,
    right: ByteString
  ): ByteString {
    return hash256(MerklePath.levelToByteString(level) + left + right)
  }
}
