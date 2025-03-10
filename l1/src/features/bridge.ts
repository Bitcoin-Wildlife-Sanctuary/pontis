import { PubKey, Sha256, UTXO } from 'scrypt-ts'
import { Postage, SupportedNetwork } from '../lib/constants'
import { ChainProvider, markSpent, UtxoProvider } from '../lib/provider'
import { Signer } from '../lib/signer'
import {
  BridgeCovenant,
  DepositAggregatorCovenant,
  stateToBatchID,
  TraceableBridgeUtxo,
  TraceableDepositAggregatorUtxo,
  TracedBridge,
  TracedDepositAggregator,
  WithdrawalExpanderCovenant,
  WithdrawalExpanderState,
} from '../covenants/index'
import { ExtPsbt } from '../lib/extPsbt'
import { CONTRACT_INDEXES, getScriptPubKeys } from '../covenants/util'
import { pickLargeFeeUtxo } from './utils/pick'
import { getDummyUtxo, supportedNetworkToBtcNetwork } from '../lib/utils'
import { inputToPrevout, outputToUtxo, reverseTxId } from '../lib/txTools'
import * as tools from 'uint8array-tools'
import {
  BatchMerkleTree,
  BridgeMerkle,
} from '../util/merkleUtils'

export async function deployBridge(
  operatorPubKey: PubKey,

  signer: Signer,
  network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  feeRate: number
) {
  // todo, verify signer's pubkey is operatorPubKey ??
  const l1Address = await signer.getAddress()
  const scriptSPKs = getScriptPubKeys(operatorPubKey)

  const depositAggregationSPK = scriptSPKs.depositAggregator
  const expanderSPK = scriptSPKs.withdrawExpander
  const state = BridgeCovenant.createEmptyState(depositAggregationSPK)
  const covenant = new BridgeCovenant(operatorPubKey, expanderSPK, state)
  const est = estimateDeployBridgeTxVSize(network, covenant, l1Address, feeRate)
  const total = BigInt(Math.ceil(feeRate * est.vSize))
  const utxos = await utxoProvider.getUtxos(l1Address, { total: Number(total) })
  if (utxos.length === 0) {
    throw new Error(`Insufficient satoshis input amount: no utxos found`)
  }
  // todo pick the exact amount of satoshis
  const feeUtxo = pickLargeFeeUtxo(utxos)
  if (feeUtxo.satoshis < total) {
    throw new Error(
      `Insufficient satoshis input amount: fee utxo(${feeUtxo.satoshis}) < total(${total})`
    )
  }
  const psbt = buildDepolyBridgeTx(
    network,
    covenant,
    l1Address,
    feeUtxo,
    feeRate
  )
  const signedPsbt = await signer.signPsbt(psbt.toHex(), psbt.psbtOptions())
  const txPsbt = psbt.combine(ExtPsbt.fromHex(signedPsbt)).finalizeAllInputs()

  const tx = txPsbt.extractTransaction()
  await chainProvider.broadcast(tx.toHex())
  markSpent(utxoProvider, tx)
  return {
    psbt: txPsbt,
    txid: tx.getId(),
    state,
    bridgeUtxo: outputToUtxo(tx, CONTRACT_INDEXES.outputIndex.bridge) as UTXO,
  }
}

export async function finalizeL1Deposit(
  signer: Signer,
  network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  bridgeUtxo: TraceableBridgeUtxo,
  depositAggregatorUtxo: TraceableDepositAggregatorUtxo,

  feeRate: number,
  estimatedVSize?: number
) {
  const changeAddress = await signer.getAddress()
  const oldState = bridgeUtxo.state

  const finalizedBatchId = stateToBatchID(
    depositAggregatorUtxo.state,
    reverseTxId(depositAggregatorUtxo.utxo.txId)
  )
  const existsNodeIndex = oldState.merkleTree.indexOf(finalizedBatchId)
  if (existsNodeIndex >= 0) {
    throw new Error('Batch already finalized')
  }
  if (finalizedBatchId === BridgeMerkle.EMPTY_BATCH_ID) {
    throw new Error('cannot finalize empty batch id')
  }
  const replacedNodeIndex = oldState.merkleTree.indexOf(
    BridgeMerkle.EMPTY_BATCH_ID
  )
  if (replacedNodeIndex < 0) {
    throw new Error('not enough empty nodes, finalizeL2Deposit first')
  }

  const tracedBridge = await BridgeCovenant.backtrace(bridgeUtxo, chainProvider)
  const tracedDepositAggregator = await DepositAggregatorCovenant.backtrace(
    depositAggregatorUtxo,
    chainProvider
  )

  const newState = BridgeCovenant.createEmptyState(
    tracedDepositAggregator.covenant.bridgeSPK
  )
  newState.merkleTree = oldState.merkleTree.map((batchId, index) =>
    index === replacedNodeIndex ? finalizedBatchId : batchId
  ) as BatchMerkleTree
  newState.batchesRoot = BridgeMerkle.calcMerkleRoot(newState.merkleTree)
  newState.depositAggregatorSPK = oldState.depositAggregatorSPK

  const outputBridgeCovenant = new BridgeCovenant(
    tracedBridge.covenant.operator,
    tracedBridge.covenant.expanderSPK,
    newState
  )

  const est = estimateFinalizeL1DepositTxVSize(
    network,
    bridgeUtxo,
    depositAggregatorUtxo,
    tracedBridge,
    tracedDepositAggregator,
    outputBridgeCovenant,
    replacedNodeIndex,
    changeAddress,
    feeRate
  )

  const total = feeRate * est.vSize
  const utxos = await utxoProvider.getUtxos(changeAddress, {
    total: Number(total),
  })
  if (utxos.length === 0) {
    throw new Error(`Insufficient satoshis input amount: no utxos found`)
  }
  const feeUtxo = pickLargeFeeUtxo(utxos)
  if (feeUtxo.satoshis < total) {
    throw new Error(
      `Insufficient satoshis input amount: fee utxo(${feeUtxo.satoshis}) < total(${total})`
    )
  }

  const finalizeL1Tx = buildFinalizeL1DepositTx(
    network,
    feeUtxo,
    bridgeUtxo,
    depositAggregatorUtxo,
    tracedBridge,
    tracedDepositAggregator,
    outputBridgeCovenant,
    replacedNodeIndex,
    changeAddress,
    feeRate,
    estimatedVSize
  )
  const signedPsbt = await signer.signPsbt(finalizeL1Tx.toHex(), finalizeL1Tx.psbtOptions())
  const txPsbt = finalizeL1Tx.combine(ExtPsbt.fromHex(signedPsbt))
  await txPsbt.finalizeAllInputsAsync()
  const tx = txPsbt.extractTransaction()
  await chainProvider.broadcast(tx.toHex())
  markSpent(utxoProvider, tx)
  return {
    psbt: txPsbt,
    txid: tx.getId(),
    state: newState,
    bridgeUtxo: outputToUtxo(tx, CONTRACT_INDEXES.outputIndex.bridge) as UTXO,
    finalizedBatchId
  }
}

export async function finalizeL2Deposit(
  signer: Signer,
  network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  finalizedBatchId: Sha256,

  bridgeUtxo: TraceableBridgeUtxo,

  feeRate: number,
  estimatedVSize?: number
) {
  if (finalizedBatchId === BridgeMerkle.EMPTY_BATCH_ID) {
    throw new Error('cannot finalize empty batch id')
  }
  const replacedNodeIndex =
    bridgeUtxo.state.merkleTree.indexOf(finalizedBatchId)
  if (replacedNodeIndex < 0) {
    throw new Error('batch id not found in merkle tree, or already finalized')
  }
  const changeAddress = await signer.getAddress()
  const oldState = bridgeUtxo.state

  const tracedBridge = await BridgeCovenant.backtrace(bridgeUtxo, chainProvider)
  const newState = BridgeCovenant.createEmptyState(
    oldState.depositAggregatorSPK
  )
  newState.merkleTree = oldState.merkleTree.map((batchId) =>
    batchId === finalizedBatchId ? BridgeMerkle.EMPTY_BATCH_ID : batchId
  ) as BatchMerkleTree
  newState.batchesRoot = BridgeMerkle.calcMerkleRoot(newState.merkleTree)
  newState.depositAggregatorSPK = oldState.depositAggregatorSPK

  const outputBridgeCovenant = new BridgeCovenant(
    tracedBridge.covenant.operator,
    tracedBridge.covenant.expanderSPK,
    newState
  )
  const est = estimateFinalizeL2DepositTxVSize(
    network,
    bridgeUtxo,
    tracedBridge,
    outputBridgeCovenant,
    replacedNodeIndex,
    changeAddress,
    feeRate
  )
  const total = feeRate * est.vSize
  const utxos = await utxoProvider.getUtxos(changeAddress, {
    total: Number(total),
  })
  if (utxos.length === 0) {
    throw new Error(`Insufficient satoshis input amount: no utxos found`)
  }
  const feeUtxo = pickLargeFeeUtxo(utxos)
  if (feeUtxo.satoshis < total) {
    console.log("bridgeUtxo.utxo", bridgeUtxo.utxo);
    throw new Error(
      `Insufficient satoshis input amount: fee utxo(${feeUtxo.satoshis}) < total(${total})`
    )
  }

  const finalizeL2Tx = buildFinalizeL2DepositTx(
    network,
    feeUtxo,
    bridgeUtxo,
    tracedBridge,
    outputBridgeCovenant,
    replacedNodeIndex,
    changeAddress,
    feeRate,
    estimatedVSize
  )
  const signedPsbt = await signer.signPsbt(finalizeL2Tx.toHex(), finalizeL2Tx.psbtOptions())
  const txPsbt = finalizeL2Tx.combine(ExtPsbt.fromHex(signedPsbt))
  await txPsbt.finalizeAllInputsAsync()
  const tx = txPsbt.extractTransaction()
  await chainProvider.broadcast(tx.toHex())
  markSpent(utxoProvider, tx)
  return {
    psbt: txPsbt,
    txid: tx.getId(),
    state: newState,
    bridgeUtxo: outputToUtxo(tx, CONTRACT_INDEXES.outputIndex.bridge) as UTXO,
  }
}

export async function createWithdrawalExpander(
  signer: Signer,
  network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,
  bridgeUtxo: TraceableBridgeUtxo,

  withdrawalMerkleRoot: Sha256,
  outputWithdrawalState: WithdrawalExpanderState,
  
  feeRate: number
) {
  const changeAddress = await signer.getAddress()

  // TODO: Does this check makes any sense?
  // withdrawals.forEach((withdrawal) =>
  //   WithdrawalMerkle.checkWithdrawalValid(withdrawal)
  // )

  const sumAmt = outputWithdrawalState.type === 'LEAF' ?
    outputWithdrawalState.withdrawAmt :
    outputWithdrawalState.leftAmt +  outputWithdrawalState.rightAmt;

  if (sumAmt > bridgeUtxo.utxo.satoshis) {
    throw new Error('withdrawal amt is greater than bridge utxo satoshis')
  }

  const tracedBridge = await BridgeCovenant.backtrace(bridgeUtxo, chainProvider)
  const outputBridgeCovenant = new BridgeCovenant(
    tracedBridge.covenant.operator,
    tracedBridge.covenant.expanderSPK,
    tracedBridge.covenant.state
  )
  
  const outputWithdrawalExpanderCovenant = new WithdrawalExpanderCovenant(
    tracedBridge.covenant.operator,
    outputWithdrawalState
  )

  const est = estimateCreateWithdrawalTxVSize(
    network,
    bridgeUtxo,
    tracedBridge,
    outputBridgeCovenant,
    outputWithdrawalExpanderCovenant,
    withdrawalMerkleRoot,
    sumAmt,
    changeAddress,
    feeRate
  )
  const total = feeRate * est.vSize
  const utxos = await utxoProvider.getUtxos(changeAddress, {
    total: Number(total),
  })
  if (utxos.length === 0) {
    throw new Error(`Insufficient satoshis input amount: no utxos found`)
  }
  const feeUtxo = pickLargeFeeUtxo(utxos)
  if (feeUtxo.satoshis < total) {
    throw new Error(
      `Insufficient satoshis input amount: fee utxo(${feeUtxo.satoshis}) < total(${total})`
    )
  }

  const createWithdrawalTx = buildCreateWithdrawalTx(
    network,
    feeUtxo,
    bridgeUtxo,
    tracedBridge,
    outputBridgeCovenant,
    outputWithdrawalExpanderCovenant,
    withdrawalMerkleRoot,
    sumAmt,
    changeAddress,
    feeRate
  )
  
  const signedPsbt = await signer.signPsbt(createWithdrawalTx.toHex(), createWithdrawalTx.psbtOptions())
  const txPsbt = createWithdrawalTx.combine(ExtPsbt.fromHex(signedPsbt))
  await txPsbt.finalizeAllInputsAsync()
  const tx = txPsbt.extractTransaction()
  await chainProvider.broadcast(tx.toHex())
  markSpent(utxoProvider, tx)
  return {
    psbt: txPsbt,
    txid: tx.getId(),
    bridgeState: outputBridgeCovenant.state,
    withdrawalState: outputWithdrawalExpanderCovenant.state,
    bridgeUtxo: outputToUtxo(tx, CONTRACT_INDEXES.outputIndex.bridge) as UTXO,
    withdrawalUtxo: outputToUtxo(tx, CONTRACT_INDEXES.outputIndex.withdrawalExpander.inBridgeTx) as UTXO,
  }
}

function estimateCreateWithdrawalTxVSize(
  network: SupportedNetwork,
  bridgeUtxo: TraceableBridgeUtxo,
  tracedBridge: TracedBridge,
  outputBridgeCovenant: BridgeCovenant,
  outputWithdrawalExpanderCovenant: WithdrawalExpanderCovenant,
  withdrawalMerkleRoot: Sha256,
  sumAmt: bigint,
  changeAddress: string,
  feeRate: number
) {
  const dummyPsbt = buildCreateWithdrawalTx(
    network,
    getDummyUtxo(changeAddress),
    bridgeUtxo,
    tracedBridge,
    outputBridgeCovenant,
    outputWithdrawalExpanderCovenant,
    withdrawalMerkleRoot,
    sumAmt,
    changeAddress,
    feeRate
  )
  return {
    psbt: dummyPsbt,
    vSize: dummyPsbt.estimateVSize(),
  }
}

function buildCreateWithdrawalTx(
  network: SupportedNetwork,
  feeUtxo: UTXO,

  bridgeUtxo: TraceableBridgeUtxo,
  tracedBridge: TracedBridge,

  outputBridgeCovenant: BridgeCovenant,
  outputWithdrawalExpanderCovenant: WithdrawalExpanderCovenant,

  withdrawalMerkleRoot: Sha256,
  sumAmt: bigint,

  changeAddress: string,
  feeRate: number,
  estimatedVSize?: number
) {
  tracedBridge.covenant.bindToUtxo(bridgeUtxo.utxo)
  if (feeUtxo.satoshis < feeRate * (estimatedVSize || 1)) {
    throw new Error('fee utxo is not enough')
  }

  const createWithdrawalTx = new ExtPsbt({
    network: supportedNetworkToBtcNetwork(network),
  })
    .addCovenantInput(tracedBridge.covenant)
    .addFeeInputs([feeUtxo])
    .addStateOutput()
    .addCovenantOutput(
      outputBridgeCovenant,
      Number(bridgeUtxo.utxo.satoshis - Number(sumAmt))
    )
    .addCovenantOutput(outputWithdrawalExpanderCovenant, Number(sumAmt))
    .change(changeAddress, feeRate)

  const inputCtxs = createWithdrawalTx.calculateInputCtxs()

  createWithdrawalTx.updateCovenantInput(
    0,
    tracedBridge.covenant,
    tracedBridge.covenant.createWithdrawal(
      0,
      inputCtxs,

      tracedBridge.trace.prevTx,
      inputToPrevout(createWithdrawalTx.unsignedTx, 1),

      withdrawalMerkleRoot,
      sumAmt
    )
  )

  return createWithdrawalTx
}

function buildFinalizeL2DepositTx(
  network: SupportedNetwork,
  feeUtxo: UTXO,

  bridgeUtxo: TraceableBridgeUtxo,
  tracedBridge: TracedBridge,

  outputBridgeCovenant: BridgeCovenant,
  replacedNodeIndex: number,

  changeAddress: string,
  feeRate: number,
  estimatedVSize?: number
) {
  tracedBridge.covenant.bindToUtxo(bridgeUtxo.utxo)
  if (feeUtxo.satoshis < feeRate * (estimatedVSize || 1)) {
    throw new Error('fee utxo is not enough')
  }

  const finalizeL2Tx = new ExtPsbt({
    network: supportedNetworkToBtcNetwork(network),
  })
    .addCovenantInput(tracedBridge.covenant)
    .addFeeInputs([feeUtxo])
    .addStateOutput()
    .addCovenantOutput(outputBridgeCovenant, bridgeUtxo.utxo.satoshis)
    .change(changeAddress, feeRate, estimatedVSize)

  const inputCtxs = finalizeL2Tx.calculateInputCtxs()

  finalizeL2Tx.updateCovenantInput(
    0,
    tracedBridge.covenant,
    tracedBridge.covenant.finalizeL2Deposit(
      0,
      inputCtxs,
      replacedNodeIndex,
      tracedBridge.trace.prevTx,
      inputToPrevout(finalizeL2Tx.unsignedTx, 1)
    )
  )

  return finalizeL2Tx
}

function estimateFinalizeL2DepositTxVSize(
  network: SupportedNetwork,
  bridgeUtxo: TraceableBridgeUtxo,
  tracedBridge: TracedBridge,
  outputBridgeCovenant: BridgeCovenant,
  replacedNodeIndex: number,
  changeAddress: string,
  feeRate: number
) {
  const dummyPsbt = buildFinalizeL2DepositTx(
    network,
    getDummyUtxo(changeAddress),
    bridgeUtxo,
    tracedBridge,
    outputBridgeCovenant,
    replacedNodeIndex,
    changeAddress,
    feeRate
  )
  return {
    psbt: dummyPsbt,
    vSize: dummyPsbt.estimateVSize(),
  }
}

function buildFinalizeL1DepositTx(
  network: SupportedNetwork,
  feeUtxo: UTXO,

  bridgeUtxo: TraceableBridgeUtxo,
  depositAggregatorUtxo: TraceableDepositAggregatorUtxo,

  tracedBridge: TracedBridge,
  tracedDepositAggregator: TracedDepositAggregator,

  outputBridgeCovenant: BridgeCovenant,
  replacedNodeIndex: number,
  changeAddress: string,
  feeRate: number,
  estimatedVSize?: number
) {
  tracedBridge.covenant.bindToUtxo(bridgeUtxo.utxo)
  tracedDepositAggregator.covenant.bindToUtxo(depositAggregatorUtxo.utxo)

  const finalizeL1Tx = new ExtPsbt({
    network: supportedNetworkToBtcNetwork(network),
  })
    .addCovenantInput(tracedBridge.covenant)
    .addCovenantInput(tracedDepositAggregator.covenant)
    .addFeeInputs([feeUtxo])
    .addStateOutput()
    .addCovenantOutput(
      outputBridgeCovenant,
      bridgeUtxo.utxo.satoshis + depositAggregatorUtxo.utxo.satoshis
    )
    .change(changeAddress, feeRate, estimatedVSize)

  const inputCtxs = finalizeL1Tx.calculateInputCtxs()

  finalizeL1Tx.updateCovenantInput(
    0,
    tracedBridge.covenant,
    tracedBridge.covenant.finalizeL1Deposit(
      0,
      inputCtxs,

      replacedNodeIndex,

      tracedBridge.trace.prevTx,
      tracedDepositAggregator.trace.prevTx,
      depositAggregatorUtxo.state.type === 'LEAF',
      inputToPrevout(finalizeL1Tx.unsignedTx, 2)
    )
  )
  finalizeL1Tx.updateCovenantInput(
    1,
    tracedDepositAggregator.covenant,
    tracedDepositAggregator.covenant.finalizeL1(
      1,
      inputCtxs,

      tracedDepositAggregator.trace.prevTx,
      depositAggregatorUtxo.state.level,
      tracedDepositAggregator.trace.ancestorTx0,
      tracedDepositAggregator.trace.ancestorTx1,

      Sha256(tools.toHex(finalizeL1Tx.unsignedTx.ins[0].hash)),
      inputToPrevout(finalizeL1Tx.unsignedTx, 2)
    )
  )

  return finalizeL1Tx
}

function estimateFinalizeL1DepositTxVSize(
  network: SupportedNetwork,
  bridgeUtxo: TraceableBridgeUtxo,
  depositAggregatorUtxo: TraceableDepositAggregatorUtxo,

  tracedBridge: TracedBridge,
  tracedDepositAggregator: TracedDepositAggregator,

  outputBridgeCovenant: BridgeCovenant,
  replacedNodeIndex: number,
  changeAddress: string,
  feeRate: number
) {
  const dummyPsbt = buildFinalizeL1DepositTx(
    network,
    getDummyUtxo(changeAddress),
    bridgeUtxo,
    depositAggregatorUtxo,
    tracedBridge,
    tracedDepositAggregator,
    outputBridgeCovenant,
    replacedNodeIndex,
    changeAddress,
    feeRate
  )
  return {
    psbt: dummyPsbt,
    vSize: dummyPsbt.estimateVSize(),
  }
}

function estimateDeployBridgeTxVSize(
  network: SupportedNetwork,
  bridgeCovenant: BridgeCovenant,
  changeAddress: string,
  feeRate: number
) {
  const dummyPsbt = buildDepolyBridgeTx(
    network,
    bridgeCovenant,
    changeAddress,
    getDummyUtxo(changeAddress),
    feeRate
  )
  return {
    psbt: dummyPsbt,
    vSize: dummyPsbt.estimateVSize(),
  }
}

function buildDepolyBridgeTx(
  network: SupportedNetwork,
  bridgeCovenant: BridgeCovenant,
  changeAddress: string,
  feeUtxo: UTXO,
  feeRate: number,
  estimatedVSize?: number
) {
  if (
    feeUtxo.satoshis <
    Postage.BRIDGE_POSTAGE + feeRate * (estimatedVSize || 1)
  ) {
    throw new Error('fee utxo is not enough')
  }

  const deployBridgeTx = new ExtPsbt({
    network: supportedNetworkToBtcNetwork(network),
  })
    .addFeeInputs([feeUtxo])
    .addStateOutput()
    .addCovenantOutput(bridgeCovenant, Postage.BRIDGE_POSTAGE)
    .change(changeAddress, feeRate)

  return deployBridgeTx
}
