import { ByteString, FixedArray, SmartContractLib } from 'scrypt-ts'

/**

what is backtrace:

we trace the bridge utxo is from the genesis outpoint,

tx0: other => fee(genesisOutpoint) + other
tx1: fee + other => bridge1(constructor(genesisOutpoint = tx0.feeOutpoint)) + other
tx2: bridge1 + other => bridge2 + other
tx3: bridge2 + other => bridge3 + other
tx4: bridge3 + other => bridge4 + other

if we are at tx2 and is unlocking/spending bridge1, we verify the fee's prevout in tx1 is same as bridge1's genesisOutpoint

if we are at tx3 and are unlocking/spending bridge2, we verify the bridge1's scriptPubkey is same as bridge2's scriptPubkey

if we are at tx4 and are unlocking/spending bridge3, we verify the bridge2's scriptPubkey is same as bridge3's scriptPubkey

in this way, we can verify the bridge utxo is from the genesis outpoint

 */

export const MAX_OUTPUT = 5
export const MAX_INPUT = 5

export type TxInput = {
  txhash: ByteString
  outputIndex: ByteString
  outputIndexVal: bigint
  sequence: ByteString
}

export type PrevTx = {
  version: ByteString

  // inputs
  inputCount: ByteString
  inputs: FixedArray<TxInput, typeof MAX_INPUT>

  // outputs
  outputCountVal: bigint
  outputCount: ByteString
  outputSatoshisList: FixedArray<ByteString, typeof MAX_OUTPUT>
  outputScriptPubkeyList: FixedArray<ByteString, typeof MAX_OUTPUT>

  //
  nLocktime: ByteString
}

/**

two types of backtrace: 

1. 
ancestorTx: fee + other => fee1 + other
prevTx: fee1 + other => bridge1 + other
currentTx: bridge1 + other => bridge2 + other

2.
ancestorTx: fee/bridge0 + other => bridge1 + other
prevTx: bridge1 + other => bridge2 + other
currentTx: bridge2 + other => bridge3 + other

 */
export type BacktraceInfo = {
  prevTx: PrevTx

  // bridge1 in prev tx
  prevTxInput: TxInput

  ancestorTx: ByteString
}

export class Backtrace extends SmartContractLib {
}
