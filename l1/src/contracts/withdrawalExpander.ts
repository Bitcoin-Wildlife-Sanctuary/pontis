import {
  assert,
  ByteString,
  FixedArray,
  hash256,
  int2ByteString,
  len,
  method,
  prop,
  PubKey,
  sha256,
  Sha256,
  Sig,
  SmartContract,
  toByteString,
} from 'scrypt-ts'
import { SHPreimage, SigHashUtils } from './sigHashUtils'
import { GeneralUtils } from './generalUtils'
import { MerklePath } from './merklePath'
import { InputsSegments, TxUtils } from './txUtil'

export type ExpanderTransaction = {
  ver: ByteString
  inputs: InputsSegments

  isCreateWithdrawalTx: boolean
  // non-empty if prev tx is createWithdrawal tx, otherwise empty
  bridgeSPK: ByteString
  bridgeAmt: bigint
  bridgeStateHash: Sha256

  contractSPK: ByteString
  output0Amt: bigint // always non-zero;
  output1Amt: bigint // zero when prev tx is createWithdrawal tx or prev tx has no second expander output;
  stateHash0: Sha256
  stateHash1: Sha256

  changeOutput: ByteString
  locktime: ByteString
}

export type ExpanderState = {
  withdrawalRoot: Sha256
}

export type WithdrawalState = {
  address: ByteString
  amt: bigint
}

export class WithdrawalExpander extends SmartContract {
  @prop()
  /// @dev-note: xonly
  operator: PubKey

  constructor(operator: PubKey) {
    super(...arguments)
    this.operator = operator
  }

  @method()
  public distribute(
    shPreimage: SHPreimage,
    sigOperator: Sig,

    isFirstExpanderOutput: boolean,

    prevLevel: bigint,
    prevTx: ExpanderTransaction,

    // we support max 4 withdrawals per tx
    // if prevLevel is 0, 1 withdrawal;
    // if prevLevel is 1, 1 or 2 withdrawals, allow 1 empty leaf;
    // if prevLevel is 2, 1, 2 or 3 withdrawals, allow 3 empty leaves;
    withdrwalAddresses: FixedArray<ByteString, 4>,
    withdrwalAmts: FixedArray<bigint, 4>,

    fundingPrevout: ByteString,
    changeOutput: ByteString
  ) {
    // check sighash preimage
    const s = SigHashUtils.checkSHPreimage(shPreimage)
    assert(this.checkSig(s, SigHashUtils.Gx))

    // check operator sig
    assert(this.checkSig(sigOperator, this.operator))

    // verify prevTx is trustable
    const prevTxId = WithdrawalExpander.getTxId(prevTx)
    const hashPrevouts = WithdrawalExpander.getHashPrevouts(
      prevTxId,
      fundingPrevout,
      prevTx.isCreateWithdrawalTx,
      isFirstExpanderOutput
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)
    assert(shPreimage.inputNumber == toByteString('00000000'))

    const leafHash0 = WithdrawalExpander.getLeafNodeHash(
      withdrwalAddresses[0],
      withdrwalAmts[0]
    )
    const leafHash1 = WithdrawalExpander.getLeafNodeHash(
      withdrwalAddresses[1],
      withdrwalAmts[1]
    )
    const leafHash2 = WithdrawalExpander.getLeafNodeHash(
      withdrwalAddresses[2],
      withdrwalAmts[2]
    )
    const leafHash3 = WithdrawalExpander.getLeafNodeHash(
      withdrwalAddresses[3],
      withdrwalAmts[3]
    )

    const level1LeftNodeHash = WithdrawalExpander.getNodeHash(
      1n,
      withdrwalAmts[0],
      leafHash0,
      withdrwalAmts[1],
      leafHash1
    )
    const level1RightNodeHash = WithdrawalExpander.getNodeHash(
      1n,
      withdrwalAmts[2],
      leafHash2,
      withdrwalAmts[3],
      leafHash3
    )
    const level2NodeHash = WithdrawalExpander.getNodeHash(
      2n,
      withdrwalAmts[0] + withdrwalAmts[1],
      level1LeftNodeHash,
      withdrwalAmts[2] + withdrwalAmts[3],
      level1RightNodeHash
    )

    const stateHash = isFirstExpanderOutput
      ? prevTx.stateHash0
      : prevTx.stateHash1
    // verify withdrawal address and amt are trustable
    if (prevLevel == 0n) {
      assert(stateHash == leafHash0)
    } else if (prevLevel == 1n) {
      assert(stateHash == level1LeftNodeHash)
    } else if (prevLevel == 2n) {
      assert(stateHash == level2NodeHash)
    } else {
      assert(false, 'withdrawal level must be 0, 1 or 2')
    }

    // verify outputs are correct
    let outputs = toByteString('')
    for (let i = 0; i < 4; i++) {
      if (withdrwalAmts[i] > 0n) {
        outputs += WithdrawalExpander.getAddressOutput(
          withdrwalAddresses[i],
          GeneralUtils.padAmt(withdrwalAmts[i])
        )
      }
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

    isFirstExpanderOutput: boolean, // if expanding first or second output

    prevLevel: bigint,
    prevTx: ExpanderTransaction,

    childExpandNodeHash0: Sha256,
    childExpandNodeHash1: Sha256,

    childExpanderAmt0: bigint, // always none-zero, if 0, throws
    childExpanderAmt1: bigint, // if 0, no new expander1 outputs

    fundingPrevout: ByteString,

    changeOutput: ByteString
  ) {
    // Check sighash preimage.
    const s = SigHashUtils.checkSHPreimage(shPreimage)
    assert(this.checkSig(s, SigHashUtils.Gx))

    // Check operator sig.
    assert(this.checkSig(sigOperator, this.operator))

    // Construct prev tx ID.
    const prevTxId = WithdrawalExpander.getTxId(prevTx)

    // Check passed prev tx is actually unlocked by the currently executing tx.
    const hashPrevouts = WithdrawalExpander.getHashPrevouts(
      prevTxId,
      fundingPrevout,
      prevTx.isCreateWithdrawalTx,
      isFirstExpanderOutput
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)

    // Check we're unlocking contract UTXO via the first input.
    assert(shPreimage.inputNumber == toByteString('00000000'))

    // verify prevLevel is greater than 2n
    assert(prevLevel > 2n)

    // verify stateHash is correct
    const nodeHash = WithdrawalExpander.getNodeHash(
      prevLevel,
      childExpanderAmt0,
      childExpandNodeHash0,
      childExpanderAmt1,
      childExpandNodeHash1
    )

    const stateHash = isFirstExpanderOutput
      ? prevTx.stateHash0
      : prevTx.stateHash1
    assert(stateHash == nodeHash)

    let outputs = toByteString('')
    let childExpander1StateHash = toByteString('')
    // first expander output and state output
    outputs += GeneralUtils.getContractOutput(
      childExpanderAmt0,
      prevTx.contractSPK
    )

    // second expander output and state output
    if (childExpanderAmt1 > 0n) {
      outputs += GeneralUtils.getContractOutput(
        childExpanderAmt1,
        prevTx.contractSPK
      )
      childExpander1StateHash = childExpandNodeHash1
    }

    const stateOut = GeneralUtils.getStateOutput(
      childExpandNodeHash0,
      childExpander1StateHash
    )
    outputs = stateOut + outputs

    // change output
    outputs += changeOutput

    assert(sha256(outputs) == shPreimage.hashOutputs)
  }

  @method()
  static getLeafNodeHash(address: ByteString, amt: bigint): Sha256 {
    // sha256(address) to avoid issue with dynamic address length
    return sha256(
      MerklePath.levelToByteString(0n) +
        sha256(sha256(address) + GeneralUtils.padAmt(amt))
    )
  }

  @method()
  static getNodeHash(
    level: bigint,
    leftAmt: bigint,
    leftChild: Sha256,
    rightAmt: bigint,
    rightChild: Sha256
  ): Sha256 {
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
   * @param batchesRoot
   * @param depositAggregatorSPK
   * @returns
   */
  static getStateHash(
    batchesRoot: Sha256,
    depositAggregatorSPK: ByteString
  ): Sha256 {
    return sha256(batchesRoot + depositAggregatorSPK)
  }

  @method()
  static getTxId(tx: ExpanderTransaction): Sha256 {
    // createWithdrawalTx: bridge + fee => state + bridge + withdrawalExpander + change(optional);
    // expanderTx: bridge + fee => state + expander + expander(exists when output1Amt > 0n) + change(optional);
    let nOutputs: bigint =
      tx.isCreateWithdrawalTx || tx.output1Amt > 0n ? 3n : 2n
    if (tx.changeOutput != toByteString('')) {
      nOutputs = nOutputs + 1n
    }

    const stateOut = GeneralUtils.getStateOutput(
      tx.isCreateWithdrawalTx ? tx.bridgeStateHash : tx.stateHash0,
      tx.isCreateWithdrawalTx ? tx.stateHash0 : tx.stateHash1
    )

    const bridgeOutputs = tx.isCreateWithdrawalTx
      ? GeneralUtils.getContractOutput(tx.bridgeAmt, tx.bridgeSPK)
      : toByteString('')

    let expanderOutputs = GeneralUtils.getContractOutput(
      tx.output0Amt,
      tx.contractSPK
    )

    if (tx.output1Amt > 0n) {
      expanderOutputs += GeneralUtils.getContractOutput(
        tx.output1Amt,
        tx.contractSPK
      )
    }

    return hash256(
      tx.ver +
        TxUtils.mergeInputsSegments(tx.inputs) +
        int2ByteString(nOutputs) +
        stateOut +
        bridgeOutputs +
        expanderOutputs +
        tx.changeOutput +
        tx.locktime
    )
  }

  @method()
  static getHashPrevouts(
    prevTxId: Sha256,
    feePrevout: ByteString,
    isCreateWithdrawalTx: boolean,
    isExpandingPrevTxFirstOutput: boolean
  ): Sha256 {
    // prevTx is expander tx, and prevout is the first output
    const contractOutIdx =
      !isCreateWithdrawalTx && isExpandingPrevTxFirstOutput
        ? toByteString('01000000')
        : toByteString('02000000')

    return sha256(prevTxId + contractOutIdx + feePrevout)
  }

  @method()
  static getAddressOutput(
    addressScript: ByteString,
    satoshis: ByteString
  ): ByteString {
    return satoshis + int2ByteString(len(addressScript)) + addressScript
  }
}
