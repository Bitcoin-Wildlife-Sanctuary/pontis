import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { SupportedNetwork } from '../../src/lib/constants'
import { getScriptPubKeys } from '../../src/covenants/instance';
import { createWithdrawal, deployBridge, deposit, finalizeL1Deposit, loadArtifacts } from './featureUtil';
import { PubKey } from 'scrypt-ts';
import { testOperatorSigner } from '../utils/testSigner';
import { testUtxoProvider } from '../utils/testProvider';
import { testChainProvider } from '../utils/testProvider';
import { before } from 'node:test';
import { verifyInputSpent } from '../utils/txHelper';
import { createLogger } from './logUtil';

use(chaiAsPromised)

const network: SupportedNetwork = 'btc-signet';

const l2Address1 = '01176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8';


describe('Test the feature of withdraw', () => {
    let scriptSPKs: ReturnType<typeof getScriptPubKeys>;

    before(async () => {
        loadArtifacts();
    })

    it('withdraw', async () => {
        const logger = createLogger('withdrawTest')

        const operatorPubKey = PubKey(await testOperatorSigner.getPublicKey());
        scriptSPKs = getScriptPubKeys(operatorPubKey);
        // deploy bridge;
        const deployBridgeRes = await deployBridge(testUtxoProvider, testChainProvider);
        logger.info('deployBridge txid', deployBridgeRes.txid)


        // deposit to bridge;   
        const depositRes = await deposit(testUtxoProvider, testChainProvider, l2Address1, BigInt(1e8), network);
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
        );
        expect(verifyInputSpent(finalizeL1DepositTx.psbt, 0)).to.be.true;
        expect(verifyInputSpent(finalizeL1DepositTx.psbt, 1)).to.be.true;
        logger.info('finalizeL1Deposit txid', finalizeL1DepositTx.txid)

        const withdrawals = [
            {
                address: l2Address1,
                amount: BigInt(1e8),
            }
        ]

        // withdraw from bridge;
        // const createWithdrawalRes = await createWithdrawal(
        //     testUtxoProvider,
        //     testChainProvider,

        //     deployBridgeRes.bridgeUtxo,
        // );
    })
})