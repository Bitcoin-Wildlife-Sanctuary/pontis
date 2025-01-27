import { Signer } from '../lib/signer'
import { UtxoProvider } from '../lib/provider'
import { ChainProvider } from '../lib/provider'
import { PubKey, Sha256, toByteString, UTXO } from 'scrypt-ts'
import { DepositAggregatorCovenant, TraceableDepositAggregatorUtxo, TracedDepositAggregator } from '../covenants'
import { Postage, SupportedNetwork } from '../lib/constants'
import {
  getDummyUtxo,
} from '../lib/utils'
import { DUST_LIMIT, ExtPsbt } from '../lib/extPsbt'
import { getScriptPubKeys } from '../covenants/instance'
import { pickLargeFeeUtxo } from './utils/pick'
import { markSpent } from '../lib/provider'
import { inputToPrevout, outputToUtxo } from '../lib/txTools'

export async function createDeposit(
  operatorPubKey: PubKey,
  signer: Signer,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  l2Address: string,
  depositAmt: bigint,

  network: SupportedNetwork,
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
    depositAggregatorCovenant,
    l1address
  )
  const total =
    BigInt(Math.ceil(feeRate * est.vSize)) +
    depositAmt

  const utxos = await utxoProvider.getUtxos(l1address, { total: Number(total) })
  if (utxos.length === 0) {
    throw new Error('Insufficient satoshis input amount')
  }
  // todo pick the exact amount of satoshis
  const feeUtxo = pickLargeFeeUtxo(utxos)

  const psbt = buildCreateDepositTx(
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
    aggregatorUtxo: outputToUtxo(tx, 0) as UTXO,
  }
}

function estimateCreateDepositTxVSize(
  covenant: DepositAggregatorCovenant,
  changeAddress: string
) {
  const dummyPsbt = buildCreateDepositTx(
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

  const createDepositTx = new ExtPsbt()
    .addFeeInputs([feeUtxo])
    .addCovenantOutput(
      depositAggregatorCovenant,
      Number(depositAggregatorCovenant.state.depositAmt)
    )
    .addStateOutput(depositAggregatorCovenant)
    .change(changeAddress, feeRate)

  return createDepositTx
}

export async function aggregateDeposit(
  signer: Signer, // operator signer
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  aggregatorUtxo0: TraceableDepositAggregatorUtxo,
  aggregatorUtxo1: TraceableDepositAggregatorUtxo,

  feeRate: number,
  estimatedVSize?: number
) {

  const tracedDepositAggregator0 = await DepositAggregatorCovenant.backtrace(aggregatorUtxo0, chainProvider)
  const tracedDepositAggregator1 = await DepositAggregatorCovenant.backtrace(aggregatorUtxo1, chainProvider)

  const outputAggregator = new DepositAggregatorCovenant(
    aggregatorUtxo0.operator,
    aggregatorUtxo0.bridgeSPK,
    DepositAggregatorCovenant.createAggregateState(
      aggregatorUtxo0.state.level + 1n,
      Sha256(tracedDepositAggregator0.covenant.serializedState()),
      Sha256(tracedDepositAggregator1.covenant.serializedState())
    ),
  )

  const changeAddress = await signer.getAddress();

  const estSize = estimateAggregateDepositTxVSize(
    getDummyUtxo(changeAddress),
    aggregatorUtxo0,
    aggregatorUtxo1,
    tracedDepositAggregator0,
    tracedDepositAggregator1,
    outputAggregator,
    changeAddress,
    feeRate
  )
  const total = feeRate * estSize + Postage.DEPOSIT_AGGREGATOR_POSTAGE;
  const utxos = await utxoProvider.getUtxos(changeAddress, { total: Number(total) });
  if (utxos.length === 0) {
    throw new Error('Insufficient satoshis input amount')
  }
  const feeUtxo = pickLargeFeeUtxo(utxos);

  const aggregateTx = buildAggregateDepositTx(
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
    aggregatorUtxo: outputToUtxo(tx, 0) as UTXO,
  }
}

function buildAggregateDepositTx(

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

  const aggregateTx = new ExtPsbt()
    .addCovenantInput(tracedDepositAggregator0.covenant)
    .addCovenantInput(tracedDepositAggregator1.covenant)
    .addFeeInputs([feeUtxo])
    .addCovenantOutput(outputAggregator, aggregatorUtxo0.utxo.satoshis + aggregatorUtxo1.utxo.satoshis)
    .addStateOutput(outputAggregator)
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
      tracedDepositAggregator1.covenant.depositData,
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
      tracedDepositAggregator1.covenant.depositData,
    )
  )

  return aggregateTx
}

function estimateAggregateDepositTxVSize(
  feeUtxo: UTXO,
  aggregatorUtxo0: TraceableDepositAggregatorUtxo,
  aggregatorUtxo1: TraceableDepositAggregatorUtxo,

  tracedDepositAggregator0: TracedDepositAggregator,
  tracedDepositAggregator1: TracedDepositAggregator,

  outputAggregator: DepositAggregatorCovenant,
  changeAddress: string,
  feeRate: number,
) {
  return buildAggregateDepositTx(
    feeUtxo,
    aggregatorUtxo0,
    aggregatorUtxo1,
    tracedDepositAggregator0,
    tracedDepositAggregator1,
    outputAggregator,
    changeAddress,
    feeRate,
  ).estimateVSize()
}
