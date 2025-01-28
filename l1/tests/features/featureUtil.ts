import { PubKey, Sha256 } from 'scrypt-ts'
import { UtxoProvider, ChainProvider } from '../../src/lib/provider'
import { SupportedNetwork } from '../../src/lib/constants'
import { TraceableDepositAggregatorUtxo } from '../../src/covenants/depositAggregatorCovenant'
import { testOperatorSigner, testUserSigner } from '../utils/testSigner'
import { DepositAggregator } from '../../src/contracts/depositAggregator'
import { WithdrawalExpander } from '../../src/contracts/withdrawalExpander'
import { Bridge } from '../../src/contracts/bridge'

import * as depositFeature from '../../src/features/deposit'
import * as bridgeFeature from '../../src/features/bridge'
import * as withdrawFeature from '../../src/features/withdraw'

import { TraceableBridgeUtxo } from '../../src/covenants/bridgeCovenant'
import { Withdrawal } from '../../src/util/merkleUtils'
import { TraceableWithdrawalExpanderUtxo } from '../../src/covenants'

export const FEE_RATE = 10
export const ALLOWED_SIZE_DIFF = 40

export function loadArtifacts() {
  Bridge.loadArtifact()
  WithdrawalExpander.loadArtifact()
  DepositAggregator.loadArtifact()
}

export async function deposit(
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  l2Address: string,
  depositAmt: bigint,

  network: SupportedNetwork
) {
  const operatorPubKey = await testOperatorSigner.getPublicKey()
  const deposit = await depositFeature.createDeposit(
    PubKey(operatorPubKey),
    testOperatorSigner,

    utxoProvider,
    chainProvider,

    l2Address,
    depositAmt,

    network,
    FEE_RATE
  )
  return deposit
}

export async function aggregate(
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  aggregatorUtxo0: TraceableDepositAggregatorUtxo,
  aggregatorUtxo1: TraceableDepositAggregatorUtxo
) {
  return await depositFeature.aggregateDeposit(
    testOperatorSigner,
    utxoProvider,
    chainProvider,

    aggregatorUtxo0,
    aggregatorUtxo1,

    FEE_RATE
  )
}

export async function finalizeL1Deposit(
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  bridgeUtxo: TraceableBridgeUtxo,
  depositAggregatorUtxo: TraceableDepositAggregatorUtxo
) {
  return await bridgeFeature.finalizeL1Deposit(
    testOperatorSigner,
    utxoProvider,
    chainProvider,

    bridgeUtxo,
    depositAggregatorUtxo,

    FEE_RATE
  )
}

export async function finalizeL2Deposit(
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  finalizedBatchId: Sha256,

  bridgeUtxo: TraceableBridgeUtxo
) {
  return await bridgeFeature.finalizeL2Deposit(
    testUserSigner,
    utxoProvider,
    chainProvider,

    finalizedBatchId,
    bridgeUtxo,

    FEE_RATE
  )
}

export async function deployBridge(
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider
) {
  const operatorPubKey = await testOperatorSigner.getPublicKey()
  return await bridgeFeature.deployBridge(
    PubKey(operatorPubKey),
    testOperatorSigner,
    utxoProvider,
    chainProvider,
    FEE_RATE
  )
}

export async function createWithdrawal(
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  bridgeUtxo: TraceableBridgeUtxo,
  withdrawals: Withdrawal[]
) {
  return await bridgeFeature.createWithdrawalExpander(
    testUserSigner,
    utxoProvider,
    chainProvider,

    bridgeUtxo,
    withdrawals,

    FEE_RATE
  )
}

export async function distributeWithdrawals(
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  withdrawExpanderUtxo: TraceableWithdrawalExpanderUtxo,
  allWithdrawals: Withdrawal[]
) {
  return await withdrawFeature.distributeWithdrawals(
    testOperatorSigner,
    utxoProvider,
    chainProvider,

    withdrawExpanderUtxo,
    allWithdrawals,

    FEE_RATE
  )
}

export async function expandWithdrawal(
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  withdrawExpanderUtxo: TraceableWithdrawalExpanderUtxo,
  withdrawals: Withdrawal[]
) {
  return await withdrawFeature.expandWithdrawal(
    testOperatorSigner,
    utxoProvider,
    chainProvider,

    withdrawExpanderUtxo,
    withdrawals,

    FEE_RATE
  )
}
