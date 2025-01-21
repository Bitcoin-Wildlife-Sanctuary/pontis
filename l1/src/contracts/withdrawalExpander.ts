import { Addr, assert, ByteString, FixedArray, hash256, method, prop, PubKey, sha256, Sha256, Sig, SmartContract, toByteString } from "scrypt-ts";
import { SHPreimage, SigHashUtils } from "./sigHashUtils";
import { Bridge, BridgeTransaction } from "./bridge";
import { GeneralUtils } from "./generalUtils";
import { MerklePath } from "./merklePath";


export type ExpanderTransaction = {
    ver: ByteString
    inputContract: ByteString
    inputFee: ByteString
    contractSPK: ByteString
    output0Amt: bigint
    output1Amt: bigint
    stateHash: Sha256
    changeOutput: ByteString
    locktime: ByteString
}

export type ExpanderState = {
    withdrawalRoot: Sha256
}

export type WithdrawalState = {
    address: Addr
    amt: bigint
}

export class WithdrawalExpander extends SmartContract {

    @prop()
    operator: PubKey

    constructor(
        operator: PubKey
    ) {
        super(...arguments)
        this.operator = operator
    }

    @method()
    public distribute(
        shPreimage: SHPreimage,
        sigOperator: Sig,

        isExpandingPrevTxFirstOutput: boolean,
        isPrevTxBridge: boolean,

        prevLevel: bigint,

        prevTxBridge: BridgeTransaction,
        prevTxExpander: ExpanderTransaction,

        prevStateHash0: Sha256,
        prevStateHash1: Sha256,
        
        // we support max 4 withdrawals per tx
        // if prevLevel is 0, 1 withdrawal; 
        // if prevLevel is 1, 1 or 2 withdrawals, allow 1 empty leaf;
        // if prevLevel is 2, 1, 2 or 3 withdrawals, allow 3 empty leaves;
        withdrwalAddresses: FixedArray<Addr, 4>,
        withdrwalAmts: FixedArray<bigint, 4>,

        fundingPrevout: ByteString,
        changeOutput: ByteString
    ) {
        // check sighash preimage
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // check operator sig
        assert(this.checkSig(sigOperator, this.operator))

        let prevTxId = Sha256(toByteString(''))
        if (isPrevTxBridge) {
            prevTxId = WithdrawalExpander.getBridgeTxId(prevTxBridge)
        } else {
            prevTxId = WithdrawalExpander.getTxId(prevTxExpander)
        }
        const hashPrevouts = WithdrawalExpander.getHashPrevouts(
            prevTxId,
            fundingPrevout,
            isPrevTxBridge,
            isExpandingPrevTxFirstOutput
        )
        assert(hashPrevouts == shPreimage.hashPrevouts);
        assert(shPreimage.inputNumber == toByteString('00000000'));

        let stateHash = toByteString('')
        if (isPrevTxBridge) {
            stateHash = prevTxBridge.expanderStateHash
        } else {
            stateHash = prevTxExpander.stateHash
        }
        // verify prevStateHash0 and prevStateHash1 are correct
        assert(stateHash == sha256(prevStateHash0 + prevStateHash1));


        let leafHash0 = WithdrawalExpander.getLeafNodeHash(withdrwalAddresses[0], withdrwalAmts[0]);
        let leafHash1 = WithdrawalExpander.getLeafNodeHash(withdrwalAddresses[1], withdrwalAmts[1]);
        let leafHash2 = WithdrawalExpander.getLeafNodeHash(withdrwalAddresses[2], withdrwalAmts[2]);
        let leafHash3 = WithdrawalExpander.getLeafNodeHash(withdrwalAddresses[3], withdrwalAmts[3]);

        let leftChildNodeHash = WithdrawalExpander.getNodeHash(1n, withdrwalAmts[0], leafHash0, withdrwalAmts[1], leafHash1);
        let rightChildNodeHash = WithdrawalExpander.getNodeHash(1n, withdrwalAmts[2], leafHash2, withdrwalAmts[3], leafHash3);
        let nodeHash = WithdrawalExpander.getNodeHash(
            2n,
            withdrwalAmts[0] + withdrwalAmts[1],
            leftChildNodeHash, 
            withdrwalAmts[2] + withdrwalAmts[3], 
            rightChildNodeHash
        );

        let outputs = toByteString('');
        for (let i = 0; i < 4; i++) {
            if (withdrwalAmts[i] > 0n) {
                outputs += WithdrawalExpander.getP2WPKHOut(GeneralUtils.padAmt(withdrwalAmts[i]), withdrwalAddresses[i]);
            }
        }

        let prevStateHash = isExpandingPrevTxFirstOutput ? prevStateHash0 : prevStateHash1;
        if (prevLevel == 0n) {
            assert(prevStateHash == leafHash0)
        } else if (prevLevel == 1n) {
            assert(prevStateHash == leftChildNodeHash)
        } else if (prevLevel == 2n) {
            assert(prevStateHash == nodeHash)
        } else {
            assert(false, 'withdrawal level must be 0, 1 or 2')
        }

        outputs += changeOutput
        assert(sha256(outputs) == shPreimage.hashOutputs)
    }

    /**
     * Expands current node of exapnsion tree into further two nodes or leaves.
     * 
     * @param shPreimage - Sighash preimage of the currently executing transaction.
     * @param sigOperator - Signature of bridge operator.
     * @param isExpandingPrevTxFirstOutput - Indicates wether expanding first or second output (i.e. branch).
     * @param isPrevTxBridge - Indicates wether prev tx is the bridge.
     * @param prevTxBridge - Previous bridge tx data. Ignored if prev tx not bridge.
     * @param prevTxExpander - Previous expander tx data. Ignored if prev tx is bridge.
     * @param prevAggregationData - Aggregation data of previous transaction.
     * @param currentAggregationData  - Aggregation data of current trnasaction.
     * @param nextAggregationData0 - Subsequent aggregation data of first branch.
     * @param nextAggregationData1 - Subsequent aggregation data of second branch.
     * @param isExpandingLeaves - Indicates wether we're exapnding into leaves.
     * @param withdrawalData0 - Withdrawal data of fist leaf. Ignored if not expanding into leaves.
     * @param withdrawalData1 - Withdrawal data of second leaf. Ignored if not expanding into leaves.
     * @param isLastAggregationLevel - Indicates wether we're on the last level of the aggregation tree (one above leaves).
     * @param fundingPrevout - The prevout for the funding UTXO.
     */
    @method()
    public expand(
        shPreimage: SHPreimage,
        sigOperator: Sig,

        isExpandingPrevTxFirstOutput: boolean,
        isPrevTxBridge: boolean,

        prevLevel: bigint,

        prevTxBridge: BridgeTransaction,
        prevTxExpander: ExpanderTransaction,

        prevStateHash0: Sha256,
        prevStateHash1: Sha256,

        childExpandNodeHash0: Sha256,
        childExpandNodeHash1: Sha256,

        childExpanderAmt0: bigint,   // always none-zero, if 0, throws
        childExpanderAmt1: bigint,   // if 0, no new expander1 outputs

        fundingPrevout: ByteString,

        changeOutput: ByteString
    ) {
        // Check sighash preimage.
        const s = SigHashUtils.checkSHPreimage(shPreimage)
        assert(this.checkSig(s, SigHashUtils.Gx))

        // Check operator sig.
        assert(this.checkSig(sigOperator, this.operator))

        // Construct prev tx ID.
        let prevTxId = Sha256(toByteString(''))
        if (isPrevTxBridge) {
            prevTxId = WithdrawalExpander.getBridgeTxId(prevTxBridge)
        } else {
            prevTxId = WithdrawalExpander.getTxId(prevTxExpander)
        }

        // Check passed prev tx is actually unlocked by the currently executing tx.
        const hashPrevouts = WithdrawalExpander.getHashPrevouts(
            prevTxId,
            fundingPrevout,
            isPrevTxBridge,
            isExpandingPrevTxFirstOutput
        )
        assert(hashPrevouts == shPreimage.hashPrevouts)

        // Check we're unlocking contract UTXO via the first input.
        assert(shPreimage.inputNumber == toByteString('00000000'))

        
        // Get root hash from prev txns state output.
        let stateHash = toByteString('')
        let expanderSPK = toByteString('')
        if (isPrevTxBridge) {
            stateHash = prevTxBridge.expanderStateHash
            expanderSPK = prevTxBridge.expanderSPK
        } else {
            stateHash = prevTxExpander.stateHash
            expanderSPK = prevTxExpander.contractSPK
        }
        // verify prevStateHash0 and prevStateHash1 are correct
        assert(stateHash == sha256(prevStateHash0 + prevStateHash1))


        // verify stateHash is correct 
        const nodeHash0 = WithdrawalExpander.getNodeHash(
            prevLevel,
            childExpanderAmt0,
            childExpandNodeHash0,
            childExpanderAmt1,
            childExpandNodeHash1
        )
        if (isExpandingPrevTxFirstOutput) {
            assert(nodeHash0 == prevStateHash0)
        } else {
            assert(nodeHash0 == prevStateHash1)
        }
        
        let outputs = toByteString('')
        outputs += GeneralUtils.getContractOutput(childExpanderAmt0, prevTxExpander.contractSPK)
        if (childExpanderAmt1 > 0n) {
            outputs += GeneralUtils.getContractOutput(childExpanderAmt1, prevTxExpander.contractSPK)
        }
        let newStateHash = sha256(childExpandNodeHash0 + childExpandNodeHash1)
        outputs += GeneralUtils.getStateOutput(newStateHash)
        outputs += changeOutput

        assert(
            sha256(outputs) == shPreimage.hashOutputs
        )
    }


    @method()
    static getLeafNodeHash(address: Addr, amt: bigint): Sha256 {
        // todo check address length;
        // todo check amt >= 0n
        return sha256(MerklePath.levelToByteString(0n) + sha256(address + GeneralUtils.padAmt(amt)))
    }

    @method()
    static getNodeHash(level: bigint, leftAmt: bigint, leftChild: Sha256, rightAmt: bigint, rightChild: Sha256): Sha256 {
        return sha256(
            MerklePath.levelToByteString(level) + 
            GeneralUtils.padAmt(leftAmt) + 
            leftChild + 
            GeneralUtils.padAmt(rightAmt) + 
            rightChild
        )
    }

    /**
     * 
     * @param nodeHash1 nodeHash1
     * @param nodeHash2 nodeHash2, empty if only one child
     * @returns 
     */
    static getStateHash(nodeHash1: Sha256, nodeHash2: Sha256): Sha256 {
        return sha256(nodeHash1 + nodeHash2)
    }

    @method()
    static getTxId(tx: ExpanderTransaction): Sha256 {
        const nOutputs = tx.changeOutput == toByteString('') ?
            toByteString('03') :
            toByteString('02')
        return hash256(
            tx.ver +
            toByteString('02') +
            tx.inputContract +
            tx.inputFee +
            nOutputs +
            GeneralUtils.getContractOutput(tx.output0Amt, tx.contractSPK) +
            GeneralUtils.getContractOutput(tx.output1Amt, tx.contractSPK) +
            GeneralUtils.getStateOutput(tx.stateHash) +
            tx.changeOutput +
            tx.locktime
        )
    }

    @method()
    static getBridgeTxId(tx: BridgeTransaction): Sha256 {
        const stateHash = Bridge.getStateHash(
            tx.batchesRoot, tx.depositAggregatorSPK
        )

        return hash256(
            tx.ver +
            tx.inputs +
            toByteString('04') +
            GeneralUtils.getContractOutput(tx.contractAmt, tx.contractSPK) +
            GeneralUtils.getStateOutput(stateHash) +
            GeneralUtils.getContractOutput(tx.expanderAmt, tx.expanderSPK) +
            GeneralUtils.getStateOutput(tx.expanderStateHash) +
            tx.locktime
        )
    }

    @method()
    static getHashPrevouts(
        txId: Sha256,
        feePrevout: ByteString,
        isPrevTxBridge: boolean,
        isExpandingPrevTxFirstOutput: boolean
    ): Sha256 {
        let contractOutIdx = toByteString('00000000')
        if (isPrevTxBridge) {
            contractOutIdx = toByteString('02000000')
        } else if (!isExpandingPrevTxFirstOutput) {
            contractOutIdx = toByteString('01000000')
        }
        return sha256(
            txId +
            contractOutIdx +
            feePrevout
        )
    }

    @method()
    static getP2WPKHOut(
        amount: ByteString,
        addr: ByteString
    ): ByteString {
        return amount + toByteString('160014') + addr
    }

}