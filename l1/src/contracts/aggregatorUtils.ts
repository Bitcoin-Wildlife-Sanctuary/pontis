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

export type AggregatorTransaction = {
  ver: ByteString // version of the transaction
  inputContract0: ByteString // the first contract input, optional, if exists.
  inputContract1: ByteString // the second contract input, optional, if exists.
  inputFee: ByteString // the fee input, required, also the last input of the transaction

  outputContractAmt: bigint // the amount of the deposit aggregator contract output
  outputContractSPK: ByteString // the script pubkey of the deposit aggregator contract output
  hashData: Sha256 // Hash of state data, stored in OP_RETURN output.

  changeOutput: ByteString // the change output, optional, if exists.
  locktime: ByteString // locktime of the transaction
}

export class AggregatorUtils extends SmartContractLib {
  @method()
  static getTxId(tx: AggregatorTransaction, isLeaf: boolean): Sha256 {
    // we only have deposit aggregator
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

  @method()
  static getHashPrevouts(
    txId0: Sha256,
    txId1: Sha256,
    feePrevout: ByteString
  ): Sha256 {
    return sha256(
      txId0 +
        toByteString('01000000') +
        txId1 +
        toByteString('01000000') +
        feePrevout
    )
  }
}
