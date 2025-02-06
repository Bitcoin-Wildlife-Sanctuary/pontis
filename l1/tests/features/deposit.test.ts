import * as dotenv from 'dotenv'
dotenv.config()

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {
  deposit,
  loadArtifacts,
  aggregate,
  finalizeL1Deposit,
  deployBridge,
  finalizeL2Deposit,
  MINIMAL_DEPOSIT_AMT,
} from './featureUtil'
import { testOperatorSigner, testUserSigner } from '../utils/testSigner'
import { PubKey, Sha256 } from 'scrypt-ts'
import { testUtxoProvider, testChainProvider } from '../utils/testProvider'
import { Postage, SupportedNetwork } from '../../src/lib/constants'
import { verifyInputSpent } from '../utils/txHelper'
import {
  stateToBatchID,
  TraceableDepositAggregatorUtxo,
} from '../../src/covenants/depositAggregatorCovenant'
import { getScriptPubKeys } from '../../src/covenants/instance'
import { reverseTxId } from '../../src/lib/txTools'
import { createLogger } from './logUtil'
import { sleepTxTime } from '../utils/sleep'
import { toXOnly } from '../../src/lib/utils'
import { AddressType } from '../../src/signers'

use(chaiAsPromised)

const network: SupportedNetwork = 'btc-signet'
const l2Address1 =
  '01176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8'
const l2Address2 =
  '00c55d3b840a60c09989377c9b4cfa6c428ef37ee7bbd47e93b0c0fa440a5be8'
const l2Address3 =
  '049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
const l2Address4 =
  '02d889448e2ce40fa6874e0bc0bd6156d535a1c9866fd9163be5756e5695493b'

describe('Test the feature of deposit', async () => {
  let scriptSPKs: ReturnType<typeof getScriptPubKeys>
  let deployBridgeRes: Awaited<ReturnType<typeof deployBridge>>
  let operatorPubKey: PubKey 
  let operatorPubKeyXOnly: PubKey

  before(async () => {
    const logger = createLogger('deposit.test.before')

    operatorPubKey = PubKey(await testOperatorSigner.getPublicKey())  
    operatorPubKeyXOnly = PubKey(toXOnly(operatorPubKey, testOperatorSigner.addressType === AddressType.P2TR))
    console.log('operatorPubKey', operatorPubKey)

    loadArtifacts()
    scriptSPKs = getScriptPubKeys(operatorPubKey)

    const operatorAddress = await testOperatorSigner.getAddress()
    const userAddress = await testUserSigner.getAddress()

    
    deployBridgeRes = await deployBridge(
      testUtxoProvider,
      testChainProvider
    )
    expect(deployBridgeRes.bridgeUtxo.satoshis).to.be.equal(Postage.BRIDGE_POSTAGE)
    logger.info('deployBridge txid', deployBridgeRes.txid)

    logger.info('operatorAddress', operatorAddress)
    logger.info('userAddress', userAddress)
  })

  it('deposit basic flow', async () => {
    const logger = createLogger('deposit basic flow')

    await sleepTxTime()
    const depositRes1 = await deposit(
      testUtxoProvider,
      testChainProvider,
      l2Address1,
      BigInt(MINIMAL_DEPOSIT_AMT),
      network
    )
    logger.info('deposit1 txid', depositRes1.txid)

    await sleepTxTime()
    const depositRes2 = await deposit(
      testUtxoProvider,
      testChainProvider,
      l2Address2,
      BigInt(MINIMAL_DEPOSIT_AMT + 1),
      network
    )
    logger.info('deposit2 txid', depositRes2.txid)

    
    await sleepTxTime()
    const level1Res0 = await aggregate(
      testUtxoProvider,
      testChainProvider,
      {
        operator: operatorPubKey,
        bridgeSPK: scriptSPKs.bridge,
        state: depositRes2.state,
        utxo: depositRes2.aggregatorUtxo,
      },
      {
        operator: operatorPubKey,
        bridgeSPK: scriptSPKs.bridge,
        state: depositRes1.state,
        utxo: depositRes1.aggregatorUtxo,
      }
    )
    expect(verifyInputSpent(level1Res0.psbt, 0)).to.be.true
    expect(verifyInputSpent(level1Res0.psbt, 1)).to.be.true
    const level1Amt0 = MINIMAL_DEPOSIT_AMT * 2 + 1
    expect(level1Res0.aggregatorUtxo.satoshis).to.be.equal(level1Amt0)
    logger.info('level1 aggregate0 txid', level1Res0.txid)

    await sleepTxTime()
    const depositRes3 = await deposit(
      testUtxoProvider,
      testChainProvider,
      l2Address3,
      BigInt(MINIMAL_DEPOSIT_AMT + 2),
      network
    )
    logger.info('deposit3 txid', depositRes3.txid)

    await sleepTxTime()
    const depositRes4 = await deposit(
      testUtxoProvider,
      testChainProvider,
      l2Address4,
      BigInt(MINIMAL_DEPOSIT_AMT + 3),
      network
    )
    logger.info('deposit4 txid', depositRes4.txid)


    await sleepTxTime()
    const level1Res1 = await aggregate(
      testUtxoProvider,
      testChainProvider,
      {
        operator: operatorPubKey,
        bridgeSPK: scriptSPKs.bridge,
        state: depositRes3.state,
        utxo: depositRes3.aggregatorUtxo,
      },
      {
        operator: operatorPubKey,
        bridgeSPK: scriptSPKs.bridge,
        state: depositRes4.state,
        utxo: depositRes4.aggregatorUtxo,
      }
    )
    expect(verifyInputSpent(level1Res1.psbt, 0)).to.be.true
    expect(verifyInputSpent(level1Res1.psbt, 1)).to.be.true
    const level1Amt1 = MINIMAL_DEPOSIT_AMT * 2  + 2 + 3
    expect(level1Res1.aggregatorUtxo.satoshis).to.be.equal(level1Amt1)
    logger.info('level1 aggregate1 txid', level1Res1.txid)

    await sleepTxTime()
    const level2Res = await aggregate(
      testUtxoProvider,
      testChainProvider,
      {
        operator: operatorPubKey,
        bridgeSPK: scriptSPKs.bridge,
        state: level1Res0.state,
        utxo: level1Res0.aggregatorUtxo,
      },
      {
        operator: operatorPubKey,
        bridgeSPK: scriptSPKs.bridge,
        state: level1Res1.state,
        utxo: level1Res1.aggregatorUtxo,
      }
    )
    expect(verifyInputSpent(level2Res.psbt, 0)).to.be.true
    const level2Amt = level1Amt0 + level1Amt1
    expect(level2Res.aggregatorUtxo.satoshis).to.be.equal(level2Amt)
    logger.info('level2 aggregate txid', level2Res.txid)


    const level2AggregatorUtxo: TraceableDepositAggregatorUtxo = {
      utxo: level2Res.aggregatorUtxo,
      state: level2Res.state,
      operator: operatorPubKey,
      bridgeSPK: scriptSPKs.bridge,
    }
    await sleepTxTime()
    const finalizeL1Res = await finalizeL1Deposit(
      testUtxoProvider,
      testChainProvider,

      {
        utxo: deployBridgeRes.bridgeUtxo,
        operator: operatorPubKey,
        expanderSPK: scriptSPKs.withdrawExpander,
        state: deployBridgeRes.state,
      },
      level2AggregatorUtxo
    )
    expect(verifyInputSpent(finalizeL1Res.psbt, 0)).to.be.true
    expect(verifyInputSpent(finalizeL1Res.psbt, 1)).to.be.true
    logger.info('finalizeL1 deposit txid', finalizeL1Res.txid)

    await sleepTxTime()
    const finalizeL2Res = await finalizeL2Deposit(
      testUtxoProvider,
      testChainProvider,
      Sha256(
        stateToBatchID(level2AggregatorUtxo.state, reverseTxId(level2Res.txid))
      ),
      {
        utxo: finalizeL1Res.bridgeUtxo,
        operator: operatorPubKey,
        expanderSPK: scriptSPKs.withdrawExpander,
        state: finalizeL1Res.state,
      }
    )
    expect(verifyInputSpent(finalizeL2Res.psbt, 0)).to.be.true
    expect(finalizeL2Res.bridgeUtxo.satoshis).to.be.equal(Postage.BRIDGE_POSTAGE + level2Amt)
    logger.info('finalizeL2 deposit txid', finalizeL2Res.txid)
  })
})
