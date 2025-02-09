import { ChainProvider, markSpent } from '../lib/provider'
import { UtxoProvider } from '../lib/provider'
import { Withdrawal, WithdrawalMerkle } from '../util/merkleUtils'
import { Signer } from '../lib/signer'
import {
  TracedWithdrawalExpander,
  WithdrawalExpanderCovenant,
} from '../covenants/withdrawalExpanderCovenant'
import { Sha256, UTXO } from 'scrypt-ts'
import { TraceableWithdrawalExpanderUtxo } from '../covenants/withdrawalExpanderCovenant'
import { ExtPsbt } from '../lib/extPsbt'
import * as tools from 'uint8array-tools'
import { inputToPrevout, outputToUtxo } from '../lib/txTools'
import { getDummyUtxo, supportedNetworkToBtcNetwork } from '../lib/utils'
import { pickLargeFeeUtxo } from './utils/pick'
import { SupportedNetwork } from 'src/lib/constants'

export async function expandWithdrawal(
  signer: Signer,
  network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  expanderUtxo: TraceableWithdrawalExpanderUtxo,
  allWithdrawals: Withdrawal[],

  feeRate: number
) {
  const changeAddress = await signer.getAddress()

  const withdrawalLevels =
    WithdrawalMerkle.getMerkleLevels(allWithdrawals).flat()

  const tracedWithdrawalExpander = await WithdrawalExpanderCovenant.backtrace(
    expanderUtxo,
    chainProvider
  )

  const hash = tracedWithdrawalExpander.covenant.serializedState()
  const levelWithdrawals = withdrawalLevels.find((v) => v.hash === hash)
  if (!levelWithdrawals) {
    throw new Error(`cannot find withdrawals for ${hash}`)
  }
  if (levelWithdrawals.withdrawals.length <= 4) {
    throw new Error(
      `withdrawals length should be greater than 4, but got ${levelWithdrawals.withdrawals.length}`
    )
  }

  const childrenForCurrent = WithdrawalMerkle.getHashChildren(
    allWithdrawals,
    Sha256(hash)
  )
  const childrenForLeft = WithdrawalMerkle.getHashChildren(
    allWithdrawals,
    Sha256(childrenForCurrent.leftChild.hash)
  )
  const childrenForRight = WithdrawalMerkle.getHashChildren(
    allWithdrawals,
    Sha256(childrenForCurrent.rightChild.hash)
  )

  const outputWithdrawalExpander0Covenant = new WithdrawalExpanderCovenant(
    tracedWithdrawalExpander.covenant.operator,
    WithdrawalExpanderCovenant.createNonLeafState(
      childrenForCurrent.leftChild.level,
      childrenForLeft.leftChild.hash,
      childrenForLeft.rightChild.hash,
      childrenForLeft.leftChild.amt,
      childrenForLeft.rightChild.amt
    )
  )
  const outputWithdrawalExpander1Covenant = new WithdrawalExpanderCovenant(
    tracedWithdrawalExpander.covenant.operator,
    WithdrawalExpanderCovenant.createNonLeafState(
      childrenForCurrent.rightChild.level,
      childrenForRight.leftChild.hash,
      childrenForRight.rightChild.hash,
      childrenForRight.leftChild.amt,
      childrenForRight.rightChild.amt
    )
  )

  if (
    outputWithdrawalExpander0Covenant.serializedState() !==
    expanderUtxo.state.leftChildRootHash
  ) {
    throw new Error('left child root hash mismatch')
  }
  if (
    outputWithdrawalExpander1Covenant.serializedState() !==
    expanderUtxo.state.rightChildRootHash
  ) {
    throw new Error('right child root hash mismatch')
  }

  const est = estimateExpandWithdrawalVSize(
    network,
    expanderUtxo,
    tracedWithdrawalExpander,
    outputWithdrawalExpander0Covenant,
    outputWithdrawalExpander1Covenant,
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

  const psbt = buildExpandWithdrawalTx(
    network,
    feeUtxo,
    expanderUtxo,
    tracedWithdrawalExpander,
    outputWithdrawalExpander0Covenant,
    outputWithdrawalExpander1Covenant,
    changeAddress,
    feeRate
  )
  const [signedPsbt] = await signer.signPsbts([
    {
      psbtHex: psbt.toHex(),
      options: psbt.psbtOptions(),
    },
  ])
  const txPsbt = psbt.combine(ExtPsbt.fromHex(signedPsbt))
  await txPsbt.finalizeAllInputsAsync()
  const tx = txPsbt.extractTransaction()
  await chainProvider.broadcast(tx.toHex())
  markSpent(utxoProvider, tx)
  return {
    psbt,
    txid: tx.getId(),
    withdrawalExpander0Utxo: outputToUtxo(tx, 1),
    withdrawalExpander0State: outputWithdrawalExpander0Covenant.state!,
    withdrawalExpander1Utxo: outputToUtxo(tx, 2),
    withdrawalExpander1State: outputWithdrawalExpander1Covenant.state!,
  }
}

function estimateExpandWithdrawalVSize(
  network: SupportedNetwork,
  withdrawalExpanderUtxo: TraceableWithdrawalExpanderUtxo,
  tracedWithdrawalExpander: TracedWithdrawalExpander,

  outputWithdrawalExpander0Covenant: WithdrawalExpanderCovenant,
  outputWithdrawalExpander1Covenant: WithdrawalExpanderCovenant,

  changeAddress: string,
  feeRate: number
) {
  const psbt = buildExpandWithdrawalTx(
    network,
    getDummyUtxo(changeAddress),
    withdrawalExpanderUtxo,
    tracedWithdrawalExpander,
    outputWithdrawalExpander0Covenant,
    outputWithdrawalExpander1Covenant,
    changeAddress,
    feeRate
  )
  return {
    psbt,
    vSize: psbt.estimateVSize(),
  }
}

function buildExpandWithdrawalTx(
  network: SupportedNetwork,
  feeUtxo: UTXO,

  withdrawalExpanderUtxo: TraceableWithdrawalExpanderUtxo,
  tracedWithdrawalExpander: TracedWithdrawalExpander,

  outputWithdrawalExpander0Covenant: WithdrawalExpanderCovenant,
  outputWithdrawalExpander1Covenant: WithdrawalExpanderCovenant,

  changeAddress: string,
  feeRate: number,
  estimatedVSize?: number
) {
  tracedWithdrawalExpander.covenant.bindToUtxo(withdrawalExpanderUtxo.utxo)
  if (feeUtxo.satoshis < feeRate * (estimatedVSize || 1)) {
    throw new Error('fee utxo is not enough')
  }

  if (withdrawalExpanderUtxo.state.level <= 2n) {
    throw new Error('withdrawal expander level should be greater than 2')
  }

  if (
    withdrawalExpanderUtxo.state.leftChildRootHash !==
    outputWithdrawalExpander0Covenant.serializedState()
  ) {
    throw new Error('left child root hash mismatch')
  }
  if (
    withdrawalExpanderUtxo.state.rightChildRootHash !==
    outputWithdrawalExpander1Covenant.serializedState()
  ) {
    throw new Error('right child root hash mismatch')
  }
  if (
    withdrawalExpanderUtxo.state.leftAmt !==
    outputWithdrawalExpander0Covenant.state.leftAmt +
      outputWithdrawalExpander0Covenant.state.rightAmt
  ) {
    throw new Error('left amt mismatch')
  }
  if (
    withdrawalExpanderUtxo.state.rightAmt !==
    outputWithdrawalExpander1Covenant.state.leftAmt +
      outputWithdrawalExpander1Covenant.state.rightAmt
  ) {
    throw new Error('right amt mismatch')
  }

  const expandWithdrawalTx = new ExtPsbt({
    network: supportedNetworkToBtcNetwork(network),
  })
    .addCovenantInput(tracedWithdrawalExpander.covenant)
    .addFeeInputs([feeUtxo])
    .addStateOutput()
    .addCovenantOutput(
      outputWithdrawalExpander0Covenant,
      Number(withdrawalExpanderUtxo.state.leftAmt)
    )
    .addCovenantOutput(
      outputWithdrawalExpander1Covenant,
      Number(withdrawalExpanderUtxo.state.rightAmt)
    )
    .change(changeAddress, feeRate)

  const inputCtxs = expandWithdrawalTx.calculateInputCtxs()
  expandWithdrawalTx.updateCovenantInput(
    0,
    tracedWithdrawalExpander.covenant,
    tracedWithdrawalExpander.covenant.expand(
      0,
      inputCtxs,

      tracedWithdrawalExpander.trace.prevTx.isCreateWithdrawalTx ||
        withdrawalExpanderUtxo.utxo.outputIndex === 1,
      tracedWithdrawalExpander.trace.prevTx,

      inputToPrevout(expandWithdrawalTx.unsignedTx, 1)
    )
  )
  return expandWithdrawalTx
}

export async function distributeWithdrawals(
  signer: Signer,
  network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  withdrawalExpanderUtxo: TraceableWithdrawalExpanderUtxo,
  allWithdrawals: Withdrawal[],

  feeRate: number
) {
  const changeAddress = await signer.getAddress()

  const withdrawalLevels =
    WithdrawalMerkle.getMerkleLevels(allWithdrawals).flat()

  const tracedWithdrawalExpander = await WithdrawalExpanderCovenant.backtrace(
    withdrawalExpanderUtxo,
    chainProvider
  )

  const hash = tracedWithdrawalExpander.covenant.serializedState()
  const levelWithdrawals = withdrawalLevels.find((v) => v.hash === hash)
  if (!levelWithdrawals) {
    throw new Error(`cannot find withdrawals for ${hash}`)
  }
  if (levelWithdrawals.withdrawals.length > 4) {
    throw new Error(
      `withdrawals length should be less than 4, but got ${levelWithdrawals.withdrawals.length}`
    )
  }

  const est = estimateDistributeWithdrawalsVSize(
    network,
    withdrawalExpanderUtxo,
    tracedWithdrawalExpander,
    levelWithdrawals.withdrawals,
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

  const psbt = buildDistributeWithdrawalsTx(
    network,
    feeUtxo,
    withdrawalExpanderUtxo,
    tracedWithdrawalExpander,
    levelWithdrawals.withdrawals,
    changeAddress,
    feeRate
  )
  const [signedPsbt] = await signer.signPsbts([
    {
      psbtHex: psbt.toHex(),
      options: psbt.psbtOptions(),
    },
  ])
  const txPsbt = psbt.combine(ExtPsbt.fromHex(signedPsbt))
  await txPsbt.finalizeAllInputsAsync()
  const tx = txPsbt.extractTransaction()
  await chainProvider.broadcast(tx.toHex())
  markSpent(utxoProvider, tx)

  const withdrawalLen =
    psbt.getChangeOutput().length === 0 ? tx.outs.length : tx.outs.length - 1
  const withdrawalUtxos = tx.outs
    .slice(0, withdrawalLen)
    .map((_, outputIndex) => outputToUtxo(tx, outputIndex) as UTXO)

  return {
    psbt,
    txid: tx.getId(),
    withdrawalUtxos,
  }
}

function estimateDistributeWithdrawalsVSize(
  network: SupportedNetwork,
  withdrawalExpanderUtxo: TraceableWithdrawalExpanderUtxo,
  tracedWithdrawalExpander: TracedWithdrawalExpander,
  withdrawals: Withdrawal[],

  changeAddress: string,
  feeRate: number
) {
  const psbt = buildDistributeWithdrawalsTx(
    network,
    getDummyUtxo(changeAddress),
    withdrawalExpanderUtxo,
    tracedWithdrawalExpander,
    withdrawals,
    changeAddress,
    feeRate
  )
  return {
    psbt,
    vSize: psbt.estimateVSize(),
  }
}

/**
 *
 * @param feeUtxo
 * @param withdrawalExpanderUtxo
 * @param tracedWithdrawalExpander
 * @param withdrawals 1 withdrawal when level=0, 2 withdrawals when level=1, 4 withdrawals when level=2
 * @param changeAddress
 * @param feeRate
 * @param estimatedVSize
 * @returns
 */
function buildDistributeWithdrawalsTx(
  network: SupportedNetwork,
  feeUtxo: UTXO,

  withdrawalExpanderUtxo: TraceableWithdrawalExpanderUtxo,
  tracedWithdrawalExpander: TracedWithdrawalExpander,
  withdrawals: Withdrawal[],

  changeAddress: string,
  feeRate: number,
  estimatedVSize?: number
) {
  // shadow clone
  withdrawals = [...withdrawals]

  tracedWithdrawalExpander.covenant.bindToUtxo(withdrawalExpanderUtxo.utxo)
  if (feeUtxo.satoshis < feeRate * (estimatedVSize || 1)) {
    throw new Error('fee utxo is not enough')
  }
  if (withdrawalExpanderUtxo.state.level > 2n) {
    throw new Error('withdrawal expander level should be less than 2')
  }

  if (withdrawalExpanderUtxo.state.level === 0n) {
    if (withdrawals.length !== 1) {
      throw new Error('withdrawals length should be 1 when level=0')
    }
  } else if (withdrawalExpanderUtxo.state.level === 1n) {
    if (withdrawals.length !== 2) {
      throw new Error('withdrawals length should be 2 when level=1')
    }
  } else if (withdrawalExpanderUtxo.state.level === 2n) {
    if (withdrawals.length !== 4) {
      throw new Error('withdrawals length should be 4 when level=2')
    }
  }

  // fill withdrawals with empty withdrawals to 4
  while (withdrawals.length < 4) {
    withdrawals.push({ l1Address: '', amt: 0n })
  }

  const distributeWithdrawalsTx = new ExtPsbt({
    network: supportedNetworkToBtcNetwork(network),
  })
    .addCovenantInput(tracedWithdrawalExpander.covenant)
    .addFeeInputs([feeUtxo])

  withdrawals.forEach((withdrawal) => {
    if (withdrawal.amt > 0n) {
      distributeWithdrawalsTx.addOutput({
        // todo: confirm address or script
        script: tools.fromHex(withdrawal.l1Address),
        value: withdrawal.amt,
      })
    }
  })
  distributeWithdrawalsTx.change(changeAddress, feeRate)

  const inputCtxs = distributeWithdrawalsTx.calculateInputCtxs()
  distributeWithdrawalsTx.updateCovenantInput(
    0,
    tracedWithdrawalExpander.covenant,
    tracedWithdrawalExpander.covenant.distribute(
      0,
      inputCtxs,

      tracedWithdrawalExpander.trace.prevTx.isCreateWithdrawalTx ||
        withdrawalExpanderUtxo.utxo.outputIndex === 1,
      withdrawalExpanderUtxo.state.level,

      tracedWithdrawalExpander.trace.prevTx,

      withdrawals.map((v) => v.l1Address),
      withdrawals.map((v) => v.amt),

      inputToPrevout(distributeWithdrawalsTx.unsignedTx, 1)
    )
  )
  return distributeWithdrawalsTx
}
