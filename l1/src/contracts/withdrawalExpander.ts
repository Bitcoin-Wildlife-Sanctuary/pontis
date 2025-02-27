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
import { InputsSegments, TxUtils } from './txUtil'

/**
 * Using the ExpanderTransaction type, you can construct a * expander bitcoin transaction hash.
 * for how to build a ExpanderTransaction from a expander transaction, please refer to the WithdrawalExpanderCovenant.getExpanderTransaction
 */
export type ExpanderTransaction = {
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
   * Whether the transaction is a createWithdrawal transaction.
   */
  isCreateWithdrawalTx: boolean
  /**
   * The script pubkey of the bridge contract output.
   * non-empty if isCreateWithdrawalTx is true, otherwise empty.
   */
  bridgeSPK: ByteString
  /**
   * The amount of the bridge contract output.
   * non-zero if isCreateWithdrawalTx is true, otherwise zero.
   */
  bridgeAmt: bigint
  /**
   * The state hash of the bridge contract output.
   * non-empty if isCreateWithdrawalTx is true, otherwise empty.
   */
  bridgeStateHash: Sha256
  /**
   * The script pubkey of the expander contract output
   */
  contractSPK: ByteString
  /**
   * The amount of the first expander contract output.
   * non-zero.
   */
  output0Amt: bigint
  /**
   * The amount of the second expander contract output.
   * zero when prev tx is createWithdrawal tx or prev tx has no second expander output;
   */
  output1Amt: bigint
  /**
   * The state hash of the first expander contract output.
   */
  stateHash0: Sha256
  /**
   * The state hash of the second expander contract output.
   * non-empty if output1Amt > 0n, otherwise empty.
   */
  stateHash1: Sha256
  /**
   * The change output of the transaction.
   */
  changeOutput: ByteString
  /**
   * The locktime of the transaction.
   */
  locktime: ByteString
}

export class WithdrawalExpander extends SmartContract {
  @prop()
  /// @dev-note: xonly
  operator: PubKey

  constructor(operator: PubKey) {
    super(...arguments)
    this.operator = operator
  }

  /**
   * Distribute the withdrawals to the expander outputs.
   * @param shPreimage sighash preimage of current tx
   * @param sigOperator the operator signature of current tx
   * @param isFirstExpanderOutput if current expander is the first expander output
   * @param prevTx previous expander transaction
   * @param withdrwalAddresses the addresses of the withdrawals
   * @param withdrwalAmts the amounts of the withdrawals
   * @param feePrevout fee prevout of current tx
   * @param changeOutput change output of current tx
   */
  @method()
  public distribute(
    shPreimage: SHPreimage,
    sigOperator: Sig,

    isFirstExpanderOutput: boolean,

    prevTx: ExpanderTransaction,

    // we support max 4 withdrawals per tx
    // if current utxo level is 0, 1 withdrawal;
    // if current utxo level is 1, 1~2 withdrawals, allow 1 empty leaf;
    // if current utxo level is 2, 1~4 withdrawals, allow 3 empty leaves;
    withdrwalAddresses: FixedArray<ByteString, 4>,
    withdrwalAmts: FixedArray<bigint, 4>,

    feePrevout: ByteString,
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
      feePrevout,
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

    const level1LeftNodeHash = WithdrawalExpander.getBranchNodeHash(
      withdrwalAmts[0],
      leafHash0,
      withdrwalAmts[1],
      leafHash1
    )
    const level1RightNodeHash = WithdrawalExpander.getBranchNodeHash(
      withdrwalAmts[2],
      leafHash2,
      withdrwalAmts[3],
      leafHash3
    )
    const level2NodeHash = WithdrawalExpander.getBranchNodeHash(
      withdrwalAmts[0] + withdrwalAmts[1],
      level1LeftNodeHash,
      withdrwalAmts[2] + withdrwalAmts[3],
      level1RightNodeHash
    )

    const stateHash = isFirstExpanderOutput
      ? prevTx.stateHash0
      : prevTx.stateHash1

    let maxLeftCount = 0n;
    if (stateHash === leafHash0) {
      // current expander tree only has 1 withdrawal
      maxLeftCount = 1n;
    } else if (stateHash === level1LeftNodeHash) {
      // current expander tree has 2 withdrawals, allow 1 empty leaf
      maxLeftCount = 2n;
    } else if (stateHash === level2NodeHash) {
      // current expander tree has 1~4 withdrawals, allow 3 empty leaves
      maxLeftCount = 4n;
    } else {
      assert(false, 'withdrawal level must be 0, 1 or 2')
    }

    // verify outputs are correct
    let outputs = toByteString('')
    for (let i = 0; i < 4; i++) {
      if (withdrwalAmts[i] > 0n && i < maxLeftCount) {
        outputs += WithdrawalExpander.buildAddressOutput(
          withdrwalAddresses[i],
          GeneralUtils.padAmt(withdrwalAmts[i])
        )
      }
    }
    outputs += changeOutput
    assert(sha256(outputs) == shPreimage.hashOutputs)
  }

  /**
   * expand current utxo into two new utxos.
   * @param shPreimage sighash preimage of current tx
   * @param sigOperator the operator signature of current tx
   * @param isFirstExpanderOutput if current expander is the first expander output
   * @param prevTx previous expander transaction
   * @param childExpandNodeHash0 left child node hash
   * @param childExpandNodeHash1 right child node hash
   * @param childExpanderAmt0 left child expander amount, required, must be non-zero
   * @param childExpanderAmt1 right child expander amount, optional, if 0, no right child expander output
   * @param feePrevout fee prevout of current tx
   * @param changeOutput change output of current tx
   */
  @method()
  public expand(
    shPreimage: SHPreimage,
    sigOperator: Sig,

    isFirstExpanderOutput: boolean,

    prevTx: ExpanderTransaction,

    childExpandNodeHash0: Sha256,
    childExpandNodeHash1: Sha256,

    childExpanderAmt0: bigint,
    childExpanderAmt1: bigint,

    feePrevout: ByteString,

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
      feePrevout,
      prevTx.isCreateWithdrawalTx,
      isFirstExpanderOutput
    )
    assert(hashPrevouts == shPreimage.hashPrevouts)

    // Check we're unlocking contract UTXO via the first input.
    assert(shPreimage.inputNumber == toByteString('00000000'))

    // verify stateHash is correct
    const nodeHash = WithdrawalExpander.getBranchNodeHash(
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

  /**
   * Get the hash of the leaf node. 
   * for WithdrawalExpander contract, merkle node hash is state hash.
   * @param address the address of the leaf node
   * @param amt the amount of the leaf node
   * @returns the hash of the leaf node
   */
  @method()
  static getLeafNodeHash(address: ByteString, amt: bigint): Sha256 {
    // sha256(address) to avoid issue with dynamic address length
    return sha256(sha256(address) + GeneralUtils.padAmt(amt))
  }

  /**
   * Get the hash of the branch node.
   * for WithdrawalExpander contract, merkle node hash is state hash.
   * @param leftAmt the amount of the left child node
   * @param leftChild the hash of the left child node
   * @param rightAmt the amount of the right child node
   * @param rightChild the hash of the right child node
   * @returns the hash of the branch node
   */
  @method()
  static getBranchNodeHash(
    leftAmt: bigint,
    leftChild: Sha256,
    rightAmt: bigint,
    rightChild: Sha256
  ): Sha256 {
    return sha256(
        GeneralUtils.padAmt(leftAmt) +
        leftChild +
        GeneralUtils.padAmt(rightAmt) +
        rightChild
    )
  }

  /**
   * Get the txid of a expander transaction.
   * @param tx the expander transaction
   * @returns the txid of the expander transaction
   */
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

  /**
   * Get the hash of the prevouts. Used to compare with the hashPrevouts in sighash preimage.
   * @param prevTxId the txid of the previous transaction
   * @param feePrevout the fee prevout of the current transaction
   * @param isCreateWithdrawalTx whether the previous transaction is a createWithdrawal transaction
   * @param isExpandingPrevTxFirstOutput whether the current transaction is expanding the first output of the previous transaction
   * @returns the hash of the prevouts
   */
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

  /**
   * Build the output of an address.
   * @param addressScript the script pubkey of the address
   * @param satoshis the amount of the output
   * @returns the output of the address
   */
  @method()
  static buildAddressOutput(
    addressScript: ByteString,
    satoshis: ByteString
  ): ByteString {
    return satoshis + int2ByteString(len(addressScript)) + addressScript
  }
}
