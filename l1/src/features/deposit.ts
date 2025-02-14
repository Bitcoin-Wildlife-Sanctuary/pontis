import { Signer } from '../lib/signer'
import { UtxoProvider } from '../lib/provider'
import { ChainProvider } from '../lib/provider'
import { PubKey, Sha256, toByteString, UTXO } from 'scrypt-ts'
import {
  DepositAggregatorCovenant,
  TraceableDepositAggregatorUtxo,
  TracedDepositAggregator,
} from '../covenants'
import { Postage, SupportedNetwork } from '../lib/constants'
import { getDummyUtxo, supportedNetworkToBtcNetwork } from '../lib/utils'
import { DUST_LIMIT, ExtPsbt } from '../lib/extPsbt'
import { getScriptPubKeys } from '../covenants/util'
import { pickLargeFeeUtxo } from './utils/pick'
import { markSpent } from '../lib/provider'
import { inputToPrevout, outputToUtxo } from '../lib/txTools'

export async function createDeposit(
  operatorPubKey: PubKey,
  signer: Signer,
  network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  l2Address: string,
  depositAmt: bigint,

  feeRate: number
) {
  const scriptSPKs = getScriptPubKeys(operatorPubKey)
  const l1address = await signer.getAddress()

  const state = DepositAggregatorCovenant.createDepositState(
    toByteString(l2Address),
    depositAmt
  )
  const depositAggregatorCovenant = new DepositAggregatorCovenant(
    operatorPubKey,
    scriptSPKs.bridge,
    state,
    network
  )

  const est = estimateCreateDepositTxVSize(
    network,
    depositAggregatorCovenant,
    l1address
  )
  const total = BigInt(Math.ceil(feeRate * est.vSize)) + depositAmt

  const utxos = await utxoProvider.getUtxos(l1address, { total: Number(total) })
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

  const psbt = buildCreateDepositTx(
    network,
    depositAggregatorCovenant,
    l1address,
    feeUtxo,
    feeRate
  )
  const [signedPsbt] = await signer.signPsbts([
    {
      psbtHex: psbt.toHex(),
      options: psbt.psbtOptions(),
    },
  ])
  const txPsbt = psbt.combine(ExtPsbt.fromHex(signedPsbt)).finalizeAllInputs()

  const tx = txPsbt.extractTransaction()
  await chainProvider.broadcast(tx.toHex())
  markSpent(utxoProvider, tx)

  return {
    psbt: txPsbt,
    txid: tx.getId(),
    state,
    aggregatorUtxo: outputToUtxo(tx, 1) as UTXO,
  }
}

function estimateCreateDepositTxVSize(
  network: SupportedNetwork,
  covenant: DepositAggregatorCovenant,
  changeAddress: string
) {
  const dummyPsbt = buildCreateDepositTx(
    network,
    covenant,
    changeAddress,
    getDummyUtxo(changeAddress),
    DUST_LIMIT
  )
  return {
    psbt: dummyPsbt,
    vSize: dummyPsbt.estimateVSize(),
  }
}

function buildCreateDepositTx(
  network: SupportedNetwork,
  depositAggregatorCovenant: DepositAggregatorCovenant,
  changeAddress: string,
  feeUtxo: UTXO,
  feeRate: number,
  estimatedVSize?: number
) {
  if (
    feeUtxo.satoshis <
    Postage.DEPOSIT_AGGREGATOR_POSTAGE + feeRate * (estimatedVSize || 1)
  ) {
    throw new Error('fee utxo is not enough')
  }

  const createDepositTx = new ExtPsbt({
    network: supportedNetworkToBtcNetwork(network),
  })
    .addFeeInputs([feeUtxo])
    .addStateOutput()
    .addCovenantOutput(
      depositAggregatorCovenant,
      Number(depositAggregatorCovenant.state.depositAmt)
    )
    .change(changeAddress, feeRate)

  return createDepositTx
}

// todo: split signer into operator signer and fee signer
export async function aggregateDeposit(
  signer: Signer, // operator signer
  network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  aggregatorUtxo0: TraceableDepositAggregatorUtxo,
  aggregatorUtxo1: TraceableDepositAggregatorUtxo,

  feeRate: number,
  estimatedVSize?: number
) {
  const tracedDepositAggregator0 = await DepositAggregatorCovenant.backtrace(
    aggregatorUtxo0,
    chainProvider
  )
  const tracedDepositAggregator1 = await DepositAggregatorCovenant.backtrace(
    aggregatorUtxo1,
    chainProvider
  )

  const outputAggregator = new DepositAggregatorCovenant(
    aggregatorUtxo0.operator,
    aggregatorUtxo0.bridgeSPK,
    DepositAggregatorCovenant.createAggregateState(
      aggregatorUtxo0.state.level + 1n,
      Sha256(tracedDepositAggregator0.covenant.serializedState()),
      Sha256(tracedDepositAggregator1.covenant.serializedState())
    )
  )

  const changeAddress = await signer.getAddress()

  const estSize = estimateAggregateDepositTxVSize(
    network,
    getDummyUtxo(changeAddress),
    aggregatorUtxo0,
    aggregatorUtxo1,
    tracedDepositAggregator0,
    tracedDepositAggregator1,
    outputAggregator,
    changeAddress,
    feeRate
  )
  const total = feeRate * estSize + Postage.DEPOSIT_AGGREGATOR_POSTAGE
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

  const aggregateTx = buildAggregateDepositTx(
    network,
    feeUtxo,
    aggregatorUtxo0,
    aggregatorUtxo1,
    tracedDepositAggregator0,
    tracedDepositAggregator1,
    outputAggregator,
    changeAddress,
    feeRate,
    estimatedVSize
  )
  const [signedPsbt] = await signer.signPsbts([
    {
      psbtHex: aggregateTx.toHex(),
      options: aggregateTx.psbtOptions(),
    },
  ])
  const txPsbt = aggregateTx.combine(ExtPsbt.fromHex(signedPsbt))
  await txPsbt.finalizeAllInputsAsync()
  const tx = txPsbt.extractTransaction()
  await chainProvider.broadcast(tx.toHex())
  markSpent(utxoProvider, tx)

  return {
    psbt: txPsbt,
    txid: tx.getId(),
    state: outputAggregator.state!,
    aggregatorUtxo: outputToUtxo(tx, 1) as UTXO,
  }
}

function buildAggregateDepositTx(
  network: SupportedNetwork,
  feeUtxo: UTXO,
  aggregatorUtxo0: TraceableDepositAggregatorUtxo,
  aggregatorUtxo1: TraceableDepositAggregatorUtxo,

  tracedDepositAggregator0: TracedDepositAggregator,
  tracedDepositAggregator1: TracedDepositAggregator,

  outputAggregator: DepositAggregatorCovenant,
  changeAddress: string,
  feeRate: number,
  estimatedVSize?: number
) {
  tracedDepositAggregator0.covenant.bindToUtxo(aggregatorUtxo0.utxo)
  tracedDepositAggregator1.covenant.bindToUtxo(aggregatorUtxo1.utxo)

  const aggregateTx = new ExtPsbt({
    network: supportedNetworkToBtcNetwork(network),
  })
    .addCovenantInput(tracedDepositAggregator0.covenant)
    .addCovenantInput(tracedDepositAggregator1.covenant)
    .addFeeInputs([feeUtxo])
    .addStateOutput()
    .addCovenantOutput(
      outputAggregator,
      aggregatorUtxo0.utxo.satoshis + aggregatorUtxo1.utxo.satoshis
    )
    .change(changeAddress, feeRate, estimatedVSize)

  const inputCtxs = aggregateTx.calculateInputCtxs()

  aggregateTx.updateCovenantInput(
    0,
    tracedDepositAggregator0.covenant,
    tracedDepositAggregator0.covenant.aggregate(
      0,
      inputCtxs,

      tracedDepositAggregator0.trace.prevTx,
      tracedDepositAggregator1.trace.prevTx,
      tracedDepositAggregator0.trace.ancestorTx0,
      tracedDepositAggregator0.trace.ancestorTx1,
      tracedDepositAggregator1.trace.ancestorTx0,
      tracedDepositAggregator1.trace.ancestorTx1,

      inputToPrevout(aggregateTx.unsignedTx, 2),
      true,
      tracedDepositAggregator0.covenant.depositData,
      tracedDepositAggregator1.covenant.depositData
    )
  )
  aggregateTx.updateCovenantInput(
    1,
    tracedDepositAggregator1.covenant,
    tracedDepositAggregator1.covenant.aggregate(
      1,
      inputCtxs,

      tracedDepositAggregator0.trace.prevTx,
      tracedDepositAggregator1.trace.prevTx,
      tracedDepositAggregator0.trace.ancestorTx0,
      tracedDepositAggregator0.trace.ancestorTx1,
      tracedDepositAggregator1.trace.ancestorTx0,
      tracedDepositAggregator1.trace.ancestorTx1,

      inputToPrevout(aggregateTx.unsignedTx, 2),
      false,
      tracedDepositAggregator0.covenant.depositData,
      tracedDepositAggregator1.covenant.depositData
    )
  )

  return aggregateTx
}

function estimateAggregateDepositTxVSize(
  network: SupportedNetwork,
  feeUtxo: UTXO,
  aggregatorUtxo0: TraceableDepositAggregatorUtxo,
  aggregatorUtxo1: TraceableDepositAggregatorUtxo,

  tracedDepositAggregator0: TracedDepositAggregator,
  tracedDepositAggregator1: TracedDepositAggregator,

  outputAggregator: DepositAggregatorCovenant,
  changeAddress: string,
  feeRate: number
) {
  return buildAggregateDepositTx(
    network,
    feeUtxo,
    aggregatorUtxo0,
    aggregatorUtxo1,
    tracedDepositAggregator0,
    tracedDepositAggregator1,
    outputAggregator,
    changeAddress,
    feeRate
  ).estimateVSize()
}
