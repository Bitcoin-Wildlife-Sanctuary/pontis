import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { SupportedNetwork } from '../../src/lib/constants'
import { getScriptPubKeys } from '../../src/covenants/instance'
import {
  createWithdrawal,
  deployBridge,
  deposit,
  distributeWithdrawals,
  expandWithdrawal,
  finalizeL1Deposit,
  loadArtifacts,
} from './featureUtil'
import { PubKey } from 'scrypt-ts'
import { testOperatorSigner } from '../utils/testSigner'
import { testUtxoProvider } from '../utils/testProvider'
import { testChainProvider } from '../utils/testProvider'
import { before } from 'node:test'
import { verifyInputSpent } from '../utils/txHelper'
import { createLogger } from './logUtil'
import { Withdrawal } from '../../src/util/merkleUtils'
import { addressToScript } from '../../src/lib/utils'

use(chaiAsPromised)

const network: SupportedNetwork = 'btc-signet'

const l2Address1 =
  '01176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8'
const l1Address =
  'bc1pj4ecjjkrpkl5sym345dhuf99gm4js0krugpd85y2ccgqje79s48qc78k3c'

describe('Test the feature of withdraw', () => {
  let scriptSPKs: ReturnType<typeof getScriptPubKeys>

  before(async () => {
    loadArtifacts()
  })

  it('withdraw', async () => {
    const logger = createLogger('withdrawTest')

    const operatorPubKey = PubKey(await testOperatorSigner.getPublicKey())
    scriptSPKs = getScriptPubKeys(operatorPubKey)
    // deploy bridge;
    const deployBridgeRes = await deployBridge(
      testUtxoProvider,
      testChainProvider
    )
    logger.info('deployBridge txid', deployBridgeRes.txid)

    // deposit to bridge;
    const depositRes = await deposit(
      testUtxoProvider,
      testChainProvider,
      l2Address1,
      BigInt(1e8),
      network
    )
    logger.info('deposit txid', depositRes.txid)

    // finalize deposit;
    const finalizeL1DepositTx = await finalizeL1Deposit(
      testUtxoProvider,
      testChainProvider,
      {
        utxo: deployBridgeRes.bridgeUtxo,
        operator: operatorPubKey,
        expanderSPK: scriptSPKs.withdrawExpander,
        state: deployBridgeRes.state,
      },
      {
        utxo: depositRes.aggregatorUtxo,
        operator: operatorPubKey,
        bridgeSPK: scriptSPKs.bridge,
        state: depositRes.state,
      }
    )
    expect(verifyInputSpent(finalizeL1DepositTx.psbt, 0)).to.be.true
    expect(verifyInputSpent(finalizeL1DepositTx.psbt, 1)).to.be.true
    logger.info('finalizeL1Deposit txid', finalizeL1DepositTx.txid)

    const withdrawals: Withdrawal[] = [
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(1e7 + 0),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(1e7 + 1),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(1e7 + 2),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(1e7 + 3),
      },

      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(1e7 + 4),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(1e7 + 5),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(1e7 + 6),
      },
    ]

    // withdraw from bridge;
    const createWithdrawalRes = await createWithdrawal(
      testUtxoProvider,
      testChainProvider,

      {
        utxo: finalizeL1DepositTx.bridgeUtxo,
        operator: operatorPubKey,
        expanderSPK: scriptSPKs.withdrawExpander,
        state: finalizeL1DepositTx.state,
      },
      withdrawals
    )
    logger.info('createWithdrawal txid', createWithdrawalRes.txid)
    expect(verifyInputSpent(createWithdrawalRes.psbt, 0)).to.be.true

    // expand withdrawal;
    const expandWithdrawalRes = await expandWithdrawal(
      testUtxoProvider,
      testChainProvider,

      {
        utxo: createWithdrawalRes.withdrawalUtxo,
        operator: operatorPubKey,
        state: createWithdrawalRes.withdrawalState!,
      },
      withdrawals
    )
    logger.info('expandWithdrawal txid', expandWithdrawalRes.txid)
    expect(verifyInputSpent(expandWithdrawalRes.psbt, 0)).to.be.true

    const distrubiteRes0 = await distributeWithdrawals(
      testUtxoProvider,
      testChainProvider,
      {
        utxo: expandWithdrawalRes.withdrawalExpander0Utxo,
        operator: operatorPubKey,
        state: expandWithdrawalRes.withdrawalExpander0State,
      },
      withdrawals
    )
    logger.info('distributeWithdrawals0 txid', distrubiteRes0.txid)
    expect(verifyInputSpent(distrubiteRes0.psbt, 0)).to.be.true

    const distrubiteRes1 = await distributeWithdrawals(
      testUtxoProvider,
      testChainProvider,
      {
        utxo: expandWithdrawalRes.withdrawalExpander1Utxo,
        operator: operatorPubKey,
        state: expandWithdrawalRes.withdrawalExpander1State,
      },
      withdrawals
    )
    logger.info('distributeWithdrawals1 txid', distrubiteRes1.txid)
    expect(verifyInputSpent(distrubiteRes1.psbt, 0)).to.be.true
  })
})
