import { ByteString, hash256, len, method, OpCode, Sha256, sha256, SmartContractLib, toByteString } from "scrypt-ts";
import { GeneralUtils } from "./generalUtils";


export type AggregatorTransaction = {
    ver: ByteString // version of the transaction
    inputContract0: ByteString  // the first contract input, optional, if exists.
    inputContract1: ByteString  // the second contract input, optional, if exists.
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

        // todo: add an depositInfo opReturn output, which contains the deposit info, convinient for the indexer

        const nInputs = isLeaf ?
            toByteString('01') :
            (toByteString('03') + tx.inputContract0 + tx.inputContract1)

        const nOutputs = tx.changeOutput == toByteString('') ?
            toByteString('03') :
            toByteString('02')

        return hash256(
            tx.ver +
            nInputs +
            tx.inputFee +

            nOutputs +
            // todo: outputContractSPK may consist of length + scriptpubkey, this may be hard to check is the outputContractSPK is valid/allowed
            GeneralUtils.getContractOutput(tx.outputContractAmt, tx.outputContractSPK) +
            toByteString('000000000000000022') +    // opreturn output:  satoshis + length of script 
            OpCode.OP_RETURN +
            toByteString('20') +    
            tx.hashData +   // todo: add some tag here which is useful for the indexer
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
            toByteString('00000000') +
            txId1 +
            toByteString('00000000') +
            feePrevout
        )
    }

}