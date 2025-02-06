import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { Postage, SupportedNetwork } from '../../src/lib/constants'
import { getScriptPubKeys } from '../../src/covenants/instance'
import {
  createWithdrawal,
  deployBridge,
  deposit,
  distributeWithdrawals,
  expandWithdrawal,
  finalizeL1Deposit,
  loadArtifacts,
  MINIMAL_DEPOSIT_AMT,
} from './featureUtil'
import { PubKey } from 'scrypt-ts'
import { testOperatorSigner, testUserSigner } from '../utils/testSigner'
import { testUtxoProvider } from '../utils/testProvider'
import { testChainProvider } from '../utils/testProvider'
import { before } from 'node:test'
import { verifyInputSpent } from '../utils/txHelper'
import { createLogger } from './logUtil'
import { Withdrawal } from '../../src/util/merkleUtils'
import { addressToScript } from '../../src/lib/utils'
import { TraceableBridgeUtxo } from '../../src/covenants'
import { sleepTxTime } from '../utils/sleep'

use(chaiAsPromised)

const network: SupportedNetwork = 'btc-signet'

const l2Address1 =
  '01176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8'
const l1Address =
  'bc1pj4ecjjkrpkl5sym345dhuf99gm4js0krugpd85y2ccgqje79s48qc78k3c'

describe('Test the feature of withdraw', () => {
  let scriptSPKs: ReturnType<typeof getScriptPubKeys>
  let operatorPubKey: PubKey;

  // only update in before and beforeEachDeposit
  let bridgeTraceableUtxo: TraceableBridgeUtxo;
  
  before(async () => {
    const logger = createLogger('withdraw.test.before');
    operatorPubKey = PubKey(await testOperatorSigner.getPublicKey())
    loadArtifacts()
    scriptSPKs = getScriptPubKeys(operatorPubKey)

    const deployBridgeRes = await deployBridge(
      testUtxoProvider,
      testChainProvider
    )
    bridgeTraceableUtxo = {
      utxo: deployBridgeRes.bridgeUtxo,
      operator: operatorPubKey,
      expanderSPK: scriptSPKs.withdrawExpander,
      state: deployBridgeRes.state,
    }
    expect(deployBridgeRes.bridgeUtxo.satoshis).to.be.equal(Postage.BRIDGE_POSTAGE)
    logger.info('deployBridge txid', deployBridgeRes.txid)
  })

  async function beforeEachDeposit(logger: ReturnType<typeof createLogger>, amt: bigint) {
    // deposit to bridge;
    await sleepTxTime()
    const depositRes = await deposit(
      testUtxoProvider,
      testChainProvider,
      l2Address1,
      amt,
      network
    )
    logger.info('deposit txid', depositRes.txid)

    // finalize deposit;
    await sleepTxTime()
    const finalizeL1DepositTx = await finalizeL1Deposit(
      testUtxoProvider,
      testChainProvider,
      bridgeTraceableUtxo,
      {
        utxo: depositRes.aggregatorUtxo,
        operator: operatorPubKey,
        bridgeSPK: scriptSPKs.bridge,
        state: depositRes.state,
      }
    )
    expect(verifyInputSpent(finalizeL1DepositTx.psbt, 0)).to.be.true
    expect(verifyInputSpent(finalizeL1DepositTx.psbt, 1)).to.be.true
    expect(finalizeL1DepositTx.bridgeUtxo.satoshis).equals(bridgeTraceableUtxo.utxo.satoshis + Number(amt))

    bridgeTraceableUtxo = {
      utxo: finalizeL1DepositTx.bridgeUtxo,
      operator: operatorPubKey,
      expanderSPK: scriptSPKs.withdrawExpander,
      state: finalizeL1DepositTx.state,
    }
    logger.info('finalizeL1Deposit txid', finalizeL1DepositTx.txid)
  }

  it('withdraw basic flow', async () => {
    const logger = createLogger('withdraw basic flow')

    const withdrawals: Withdrawal[] = [
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(MINIMAL_DEPOSIT_AMT + 0),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(MINIMAL_DEPOSIT_AMT + 1),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(MINIMAL_DEPOSIT_AMT + 2),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(MINIMAL_DEPOSIT_AMT + 3),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(MINIMAL_DEPOSIT_AMT + 4),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(MINIMAL_DEPOSIT_AMT + 5),
      },
      {
        l1Address: addressToScript(l1Address),
        amt: BigInt(MINIMAL_DEPOSIT_AMT + 6),
      },
    ]
    const totalWithdrawAmt = withdrawals.reduce((acc, w) => acc + w.amt, BigInt(0));
    await beforeEachDeposit(logger, totalWithdrawAmt);

    // withdraw from bridge;
    await sleepTxTime()
    const createWithdrawalRes = await createWithdrawal(
      testUtxoProvider,
      testChainProvider,

      bridgeTraceableUtxo,
      withdrawals
    )
    logger.info('createWithdrawal txid', createWithdrawalRes.txid)
    expect(verifyInputSpent(createWithdrawalRes.psbt, 0)).to.be.true
    expect(createWithdrawalRes.bridgeUtxo.satoshis).equals(bridgeTraceableUtxo.utxo.satoshis - Number(totalWithdrawAmt))
    expect(createWithdrawalRes.withdrawalUtxo.satoshis).equals( Number(totalWithdrawAmt))

    // expand withdrawal;
    await sleepTxTime()
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
    const withdrawAmt0 = withdrawals.slice(0, 4).reduce((acc, w) => acc + w.amt, BigInt(0));
    const withdrawAmt1 = withdrawals.slice(4, 8).reduce((acc, w) => acc + w.amt, BigInt(0));
    expect(expandWithdrawalRes.withdrawalExpander0Utxo.satoshis).equals(Number(withdrawAmt0))
    expect(expandWithdrawalRes.withdrawalExpander1Utxo.satoshis).equals(Number(withdrawAmt1))

    await sleepTxTime()
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
    expect(distrubiteRes0.withdrawalUtxos.length).equals(4)
    distrubiteRes0.withdrawalUtxos.forEach((utxo, index) => {
      expect(utxo.satoshis).equals(Number(withdrawals[index].amt))
      expect(utxo.script).equals(withdrawals[index].l1Address)
    })
    
    await sleepTxTime()
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
    expect(distrubiteRes1.withdrawalUtxos.length).equals(3)
    distrubiteRes1.withdrawalUtxos.forEach((utxo, index) => {
      expect(utxo.satoshis).equals(Number(withdrawals[index + 4].amt))
      expect(utxo.script).equals(withdrawals[index + 4].l1Address)
    })
  })
})
