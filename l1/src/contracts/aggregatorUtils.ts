import {
  ByteString,
  hash256,
  method,
  sha256,
  Sha256,
  SmartContractLib,
  toByteString,
} from 'scrypt-ts'
import { GeneralUtils } from './generalUtils'

/**
 * Using the AggregatorTransaction type, you can construct a * deposit/aggregation bitcoin transaction hash.
 * for how to build a AggregatorTransaction from a deposit/aggregation transaction, please refer to the DepositAggregatorCovenant.getAggregatorTransaction
 */
export type AggregatorTransaction = {
  /**
   * The version of the bitocin transaction.
   * currently, ther version is always 2, in ByteString format 0x02000000.
   */
  ver: ByteString
  /**
   * If the transaction is a aggregation transaction, the first input is the aggregator contract input.
   * Otherwise, leave it empty ByteString.
   */
  inputContract0: ByteString
  /**
   * If the transaction is a aggregation transaction, the second input is the aggregator contract input,
   * Otherwise, leave it empty.
   */
  inputContract1: ByteString
  /**
   * The fee input if the transaction has a fee input, required.
   */
  inputFee: ByteString
  /**
   * The satoshis/amount of the deposit aggregator contract output
   */
  outputContractAmt: bigint
  /**
   * The script pubkey of the deposit aggregator contract output
   */
  outputContractSPK: ByteString
  /**
   * Hash of state data, stored in OP_RETURN output.
   *
   * @note: Plain state data is used when the transaction is a deposit transaction. Otherwise, it is the hash of the state data.
   */
  hashData: Sha256

  /**
   * The change output, optional, if exists.
   */
  changeOutput: ByteString
  /**
   * The locktime of the transaction
   */
  locktime: ByteString
}

export class AggregatorUtils extends SmartContractLib {
  @method()
  static getTxId(tx: AggregatorTransaction, isLeaf: boolean): Sha256 {
    // leaf deposit tx: feeInput => aggregatorContractOutput + stateOutput
    // non-leaf deposit tx: aggregatorContractInput + aggregatorContractInput + feeInput => aggregatorContractOutput + stateOutput

    // optimize: add an depositInfo opReturn output in the tx of deploying DepositAggregator, in case of losing the deposit info which is stored in offline;

    const nInputs = isLeaf
      ? toByteString('01')
      : toByteString('03') + tx.inputContract0 + tx.inputContract1

    const nOutputs =
      tx.changeOutput != toByteString('')
        ? toByteString('03')
        : toByteString('02')

    return hash256(
      tx.ver +
        nInputs +
        tx.inputFee +
        nOutputs +
        GeneralUtils.getStateOutput(tx.hashData, toByteString('')) +
        GeneralUtils.getContractOutput(
          tx.outputContractAmt,
          tx.outputContractSPK
        ) +
        tx.changeOutput +
        tx.locktime
    )
  }

  /**
   * Get the hash of the transaction prevouts.
   * @param txId0 - The transaction id of the first input.
   * @param txId1 - The transaction id of the second input.
   * @param feePrevout - The fee input.
   * @returns The hash of the previous outputs.
   */
  @method()
  static getHashPrevouts(
    txId0: Sha256,
    txId1: Sha256,
    feePrevout: ByteString
  ): Sha256 {
    // used in aggregation transaction and finalizeL1 transaction
    // prevouts for bridge tx:
    // bridgePrevout[txid + outputIndex(always 1)] + aggregatorPrevout[txid + outputIndex(always 1)] + feePrevout;
    // prevouts for aggregation tx:
    // aggregatorPrevout[txid + outputIndex(always 1)] + aggregatorPrevout[txid + outputIndex(always 1)] + feePrevout;
    return sha256(
      txId0 +
        toByteString('01000000') +
        txId1 +
        toByteString('01000000') +
        feePrevout
    )
  }
}
