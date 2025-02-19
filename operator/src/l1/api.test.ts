

import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { ChainProvider, DefaultSigner, EnhancedProvider, getContractScriptPubKeys, loadContractArtifacts, Signer, SupportedNetwork, TestChainProvider, TestUtxoProvider, utils } from 'l1'
import { createMemoryOffChainDB, OffchainDataProvider } from './deps/offchainDataProvider'
import { L1Provider, MockL1Provider } from './deps/l1Provider'
import * as api from './api'
import * as bitcoinjs from '@scrypt-inc/bitcoinjs-lib'
import * as ecc from '@bitcoinerlab/secp256k1'
import { ECPairFactory } from 'ecpair'
import { PubKey } from 'scrypt-ts'
import { getContractAddresses } from './utils/contractUtil'
import { DepositBatch, L1Address, L1TxHash, L2Address, Withdrawal, WithdrawalBatch } from '../state'
import { Decipher } from 'crypto'

const ECPair = ECPairFactory(ecc)
bitcoinjs.initEccLib(ecc)


use(chaiAsPromised)

const defaultChainProvider = new TestChainProvider()
const defaultUtxoProvider = new TestUtxoProvider()
const defaultFeeRate = 10
const l2Addresses: L2Address[] = [
    '0x176a1bd84444c89232ec27754698e5d2e7e1a7f1539f12027f28b23ec9f3d8',
    '0x00c55d3b840a60c09989377c9b4cfa6c428ef37ee7bbd47e93b0c0fa440a5be8',
    '0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    '0x2d889448e2ce40fa6874e0bc0bd6156d535a1c9866fd9163be5756e5695493b'
]

const operatorSigner = new DefaultSigner(ECPair.fromWIF('L2Lnz6FoeWLdEdG7Kk8JnBr1Vb2hdcvPNR1BkkfvVA9Piax83L5U'));
const l1Network: SupportedNetwork = 'fractal-testnet';



describe('test l1 api', () => {

    let operatorPubKey: PubKey
    let spks: ReturnType<typeof getContractScriptPubKeys>
    let addresses: ReturnType<typeof getContractAddresses>

    let offchainDataProvider: OffchainDataProvider
    let l1Provider: MockL1Provider
    const createEnhancedUtxoProvider = () => {
        const provider = new EnhancedProvider(defaultUtxoProvider, defaultChainProvider, false)
        return provider
    }


    before(async () => {
        loadContractArtifacts()
        operatorPubKey = PubKey(await operatorSigner.getPublicKey())
        spks = getContractScriptPubKeys(operatorPubKey)
        addresses = getContractAddresses(operatorSigner, l1Network)
    })

    beforeEach(async () => {
        offchainDataProvider = createMemoryOffChainDB()
        l1Provider = new MockL1Provider()

        const txid = await api.createBridgeContractIfNotExists(
            operatorSigner,
            l1Network,
            defaultUtxoProvider,
            defaultChainProvider,
            offchainDataProvider,
            l1Provider,
            defaultFeeRate,
            false
        )
        l1Provider.setListUtxosByRawTxs([await defaultChainProvider.getRawTransaction(txid)]);
    })

    it('api.getCurrentBlockNumber should return number', async () => {
        const blockNumber = await api.getL1CurrentBlockNumber(l1Provider)
        expect(blockNumber).to.be.a('number')
    })

    it('api.getTransactionStatus should return status', async () => {
        l1Provider.setGetTransactionStatus('MINED')
        const status = await api.getL1TransactionStatus(l1Provider, '8095bd333ba059defa5f28a4477f7799322a3792806b66be32f2423fe82763a7')
        expect(status).to.equal('MINED')
    })

    it('api.createBridgeContractIfNotExists should create new bridge contract when no bridge contract exists', async () => {
        const txid = await api.createBridgeContractIfNotExists(
            operatorSigner,
            l1Network,
            defaultUtxoProvider,
            defaultChainProvider,
            offchainDataProvider,
            l1Provider,
            defaultFeeRate
        )
        expect(txid).to.equal(await offchainDataProvider.getLatestBridgeTxid())
    })

    it('api.createBridgeContractIfNotExists should not create new bridge contract when bridge contract exists', async () => {
        const localL1Provider = new MockL1Provider();
        const localOffchainDataProvider = createMemoryOffChainDB();

        const txid = await api.createBridgeContractIfNotExists(
            operatorSigner,
            l1Network,
            defaultUtxoProvider,
            defaultChainProvider,
            localOffchainDataProvider,
            localL1Provider,
            defaultFeeRate
        )
        localL1Provider.setListUtxosByRawTxs([await defaultChainProvider.getRawTransaction(txid)]);
        const txid2 = await api.createBridgeContractIfNotExists(
            operatorSigner,
            l1Network,
            defaultUtxoProvider,
            defaultChainProvider,
            localOffchainDataProvider,
            localL1Provider,
            defaultFeeRate
        )
        expect(txid2).to.equal(txid)
    })

    it('api.createBridgeContractIfNotExists should not create new bridge contract when bridge contract exists but not in utxos', async () => {
        const localL1Provider = new MockL1Provider();
        const localOffchainDataProvider = createMemoryOffChainDB();

        const txid = await api.createBridgeContractIfNotExists(
            operatorSigner,
            l1Network,
            defaultUtxoProvider,
            defaultChainProvider,
            localOffchainDataProvider,
            localL1Provider,
            defaultFeeRate
        )
        const txid2 = await api.createBridgeContractIfNotExists(
            operatorSigner,
            l1Network,
            defaultUtxoProvider,
            defaultChainProvider,
            offchainDataProvider,
            l1Provider,
            defaultFeeRate
        )
        expect(txid2).not.equal(txid)
    })

    describe('test for listDeposits', () => {
        it('api.listDeposits should return deposits when utxo and offchain data are both have same deposit', async () => {
            const deposits = await createDeposits(2, offchainDataProvider)

            l1Provider.setListUtxosByRawTxs(await getRawTxs(deposits.map(d => d.origin.hash), defaultChainProvider), 1);
            deposits.forEach(d => d.origin.status = 'MINED')
            deposits.forEach(d => { if (d.origin.status === 'MINED') { d.origin.blockNumber = 1 } })

            const deposits2 = await api.listDeposits(
                0,
                100,
                operatorSigner,
                l1Network,
                l1Provider,
                offchainDataProvider
            )
            expect(deposits2).to.deep.equal(deposits)
        })

        it('api.listDeposits should return empty array when no deposit utxo in the range', async () => {
            const deposits = await createDeposits(2, offchainDataProvider)
            l1Provider.setListUtxosByRawTxs(await getRawTxs(deposits.map(d => d.origin.hash), defaultChainProvider), 1);
            deposits.forEach(d => d.origin.status = 'MINED')
            deposits.forEach(d => { if (d.origin.status === 'MINED') { d.origin.blockNumber = 1 }})
            const deposits2 = await api.listDeposits(
                90,
                100,
                operatorSigner,
                l1Network,
                l1Provider,
                offchainDataProvider
            )
            expect(deposits.length).to.equal(2)
            expect(deposits2).to.deep.equal([])
        })

        it('api.listDeposits should return empty array when no deposits not in offchain data', async () => {
            const deposits = await createDeposits(2, offchainDataProvider)

            l1Provider.setListUtxosByRawTxs(await getRawTxs(deposits.map(d => d.origin.hash), defaultChainProvider), 1);
            deposits.forEach(d => d.origin.status = 'MINED')
            deposits.forEach(d => { if (d.origin.status === 'MINED') { d.origin.blockNumber = 1 }})

            const deposits2 = await api.listDeposits(
                0,
                100,
                operatorSigner,
                l1Network,
                l1Provider,
                createMemoryOffChainDB()
            )
            expect(deposits.length).to.equal(2)
            expect(deposits2).to.deep.equal([])
        })
    })

    describe('test for aggregateLevelDeposits', () => {
        it('api.createDeposit should work', async () => {
            const deposit = (await createDeposits(1, offchainDataProvider))[0]
            expect({ recipient: deposit.recipient, amount: deposit.amount }).to.deep.equal(await offchainDataProvider.getDepositInfo(deposit.origin.hash))
        })

        it('api.aggregateLevelDeposits should not work when only 1 deposit in the batch', async () => {
            const batch: DepositBatch = {
                status: 'BEING_AGGREGATED',
                deposits: await createDeposits(1, offchainDataProvider),
                aggregationTxs: []
            }
            expect(api.aggregateLevelDeposits(
                operatorSigner,
                l1Network,
                createEnhancedUtxoProvider(),

                defaultFeeRate,
                batch
            )).to.be.rejectedWith('batch is already aggregated, should finalize to l1 bridge')
        })
        // it('api.aggregateLevelDeposits should not work when the batch should be finalized on L1', async () => {
        //     const batch: DepositBatch = {
        //         status: 'BEING_AGGREGATED',
        //         deposits: await createDeposits(2, offchainDataProvider),
        //         aggregationTxs: []
        //     }
        //     const txids: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     batch.aggregationTxs.push(txids.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        //     expect(api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )).to.be.rejectedWith('batch is already aggregated, should finalize to l1 bridge')
        // })
        // it(`api.aggregateLevelDeposits should work for 2^n(2**6) deposits in every level`, async () => {
        //     const batch: DepositBatch = {
        //         status: 'BEING_AGGREGATED',
        //         deposits: await createDeposits(2 ** 6, offchainDataProvider),
        //         aggregationTxs: []
        //     }
        //     const txids: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     expect(txids.length).to.equal(2 ** 5);
        //     batch.aggregationTxs.push(txids.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        //     const txids2: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     expect(txids2.length).to.equal(2 ** 4);
        //     batch.aggregationTxs.push(txids2.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        //     const txids3: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     expect(txids3.length).to.equal(2 ** 3);
        //     batch.aggregationTxs.push(txids3.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        //     const txids4: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     expect(txids4.length).to.equal(2 ** 2);
        //     batch.aggregationTxs.push(txids4.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        //     const txids5: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     expect(txids5.length).to.equal(2 ** 1);
        //     batch.aggregationTxs.push(txids5.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        //     const txids6: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     expect(txids6.length).to.equal(2 ** 0);
        //     batch.aggregationTxs.push(txids6.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        // })
    })

    describe('test for finalizeDepositBatchOnL1', () => {
        it('api.finalizeDepositBatchOnL1 should work when there is only one deposit in the batch', async () => {
            const batch: DepositBatch = {
                status: 'BEING_AGGREGATED',
                deposits: await createDeposits(1, offchainDataProvider),
                aggregationTxs: []
            }
            const txid = await api.finalizeDepositBatchOnL1(
                operatorSigner,
                l1Network,
                defaultUtxoProvider,
                defaultChainProvider,
                l1Provider,
                offchainDataProvider,
                defaultFeeRate,
                batch
            )
            expect(txid).to.equal(await offchainDataProvider.getLatestBridgeTxid())
        })
        // it('api.finalizeDepositBatchOnL1 should work when the batch should be finalized on L1', async () => {
        //     const batch: DepositBatch = {
        //         status: 'BEING_AGGREGATED',
        //         deposits: await createDeposits(2, offchainDataProvider),
        //         aggregationTxs: []
        //     }
        //     const txids: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     batch.aggregationTxs.push(txids.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        //     const txid = await api.finalizeDepositBatchOnL1(
        //         operatorSigner,
        //         l1Network,
        //         defaultUtxoProvider,
        //         defaultChainProvider,
        //         l1Provider,
        //         offchainDataProvider,
        //         defaultFeeRate,
        //         batch
        //     )
        //     expect(txid).to.equal(await offchainDataProvider.getLatestBridgeTxid())
        // })
        // it('api.finalizeDepositBatchOnL1 should not work when the batch is under aggregation', async () => {
        //     const batch: DepositBatch = {
        //         status: 'BEING_AGGREGATED',
        //         deposits: await createDeposits(4, offchainDataProvider),
        //         aggregationTxs: []
        //     }
        //     const txids: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     batch.aggregationTxs.push(txids.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
        //     expect(api.finalizeDepositBatchOnL1(
        //         operatorSigner,
        //         l1Network,
        //         defaultUtxoProvider,
        //         defaultChainProvider,
        //         l1Provider,
        //         offchainDataProvider,
        //         defaultFeeRate,
        //         batch
        //     )).to.eventually.be.rejectedWith('last level aggregation txs is not 1')
        // })
        it('api.finalizeDepositBatchOnL1 should not work when the merkle tree is full', async () => {
            const batch: DepositBatch = {
                status: 'BEING_AGGREGATED',
                deposits: await createDeposits(2, offchainDataProvider),
                aggregationTxs: []
            }
            const doAFinalize = async () => {
                const batch: DepositBatch = {
                    status: 'BEING_AGGREGATED',
                    deposits: await createDeposits(1, offchainDataProvider),
                    aggregationTxs: []
                }
                const txid = await api.finalizeDepositBatchOnL1(
                    operatorSigner,
                    l1Network,
                    defaultUtxoProvider,
                    defaultChainProvider,
                    l1Provider,
                    offchainDataProvider,
                    defaultFeeRate,
                    batch
                )
                l1Provider.setListUtxosByRawTxs([await defaultChainProvider.getRawTransaction(txid)])
                await offchainDataProvider.setLatestBridgeTxid(txid)
            }

            let count = 16;
            while(count--> 0) {
                await doAFinalize();
            }
            expect(doAFinalize()).to.eventually.be.rejectedWith('the bridge state batchId is full, please finalizeL2 to clear one batchId')
        })
        it('api.finalizeDepositBatchOnL1 should not work when the batch has an finalizeBatchTx', async () => {
            const deposits = await createDeposits(1, offchainDataProvider)
            const testFn = (status: DepositBatch['status']) => {
                const batch: any = {
                    status,
                    deposits,
                    aggregationTxs: [],
                    finalizeBatchTx: { hash: '0x123', status: 'MINED', blockNumber: 1, type: 'l1tx' }
                }
                expect(api.finalizeDepositBatchOnL1(
                    operatorSigner,
                    l1Network,
                    defaultUtxoProvider,
                    defaultChainProvider,
                    l1Provider,
                    offchainDataProvider,
                    defaultFeeRate,
                    batch
                )).to.eventually.be.rejectedWith('batch is already finalized, should not finalize again')
            }
            testFn('BEING_AGGREGATED')
            testFn('AGGREGATED')
            testFn('FINALIZED')
            testFn('SUBMITTED_TO_L2')
            testFn('DEPOSITED')
            testFn('SUBMITTED_FOR_COMPLETION')
            testFn('COMPLETED')
        })
    })

    describe('test for finalizeDepositBatchOnL2', () => {
        // it('api.finalizeDepositBatchOnL2 should work when the batch should be finalized on L2', async () => {
        //     let batch: DepositBatch = {
        //         status: 'BEING_AGGREGATED',
        //         deposits: await createDeposits(2, offchainDataProvider),
        //         aggregationTxs: []
        //     }
        //     const txids: L1TxHash[] = await api.aggregateLevelDeposits(
        //         operatorSigner,
        //         l1Network,
        //         createEnhancedUtxoProvider(),
        //         defaultFeeRate,
        //         batch
        //     )
        //     batch.aggregationTxs.push(txids.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))

        //     batch = {
        //         ...batch,
        //         status: 'FINALIZED',
        //         finalizeBatchTx: {
        //             hash: await api.finalizeDepositBatchOnL1(
        //                 operatorSigner,
        //                 l1Network,
        //                 defaultUtxoProvider,
        //                 defaultChainProvider,
        //                 l1Provider,
        //                 offchainDataProvider,
        //                 defaultFeeRate,
        //                 batch
        //             ),
        //             status: 'MINED',
        //             blockNumber: 1,
        //             type: 'l1tx'
        //         }
        //     }
        //     l1Provider.setListUtxosByRawTxs([await defaultChainProvider.getRawTransaction(batch.finalizeBatchTx.hash)])
        //
        //     batch = {
        //         ...batch,
        //         status: 'DEPOSITED',
        //         depositTx: { hash: '0x123', status: 'SUCCEEDED', type: 'l2tx' }
        //     }
        //     const txid = await api.finalizeDepositBatchOnL2(
        //         operatorSigner,
        //         l1Network,
        //         defaultUtxoProvider,
        //         defaultChainProvider,
        //         l1Provider,
        //         offchainDataProvider,
        //         defaultFeeRate,
        //         batch
        //     )
        //     expect(txid).to.equal(await offchainDataProvider.getLatestBridgeTxid())
        // })
        it('api.finalizeDepositBatchOnL2 should not work when the batch is under aggregation', async () => {
            const batch: DepositBatch = {
                status: 'BEING_AGGREGATED',
                deposits: await createDeposits(4, offchainDataProvider),
                aggregationTxs: []
            }
            expect(api.finalizeDepositBatchOnL2(
                operatorSigner,
                l1Network,
                defaultUtxoProvider,
                defaultChainProvider,
                l1Provider,
                offchainDataProvider,
                defaultFeeRate,
                batch
            )).to.eventually.be.rejectedWith('batch is not finalized on L1, should not verify')
        })
        it('api.finalizeDepositBatchOnL2 should not work when the batch has an verifyTx', async () => {
            const batch: DepositBatch = {
                status: 'COMPLETED',
                deposits: await createDeposits(1, offchainDataProvider),
                aggregationTxs: [],
                finalizeBatchTx: { hash: '0x123', status: 'MINED', blockNumber: 1, type: 'l1tx' },
                depositTx: { hash: '0x123', status: 'SUCCEEDED', type: 'l2tx' },
                verifyTx: { hash: '0x123', status: 'MINED', blockNumber: 1, type: 'l1tx' }
            }
            expect(api.finalizeDepositBatchOnL2(
                operatorSigner,
                l1Network,
                defaultUtxoProvider,
                defaultChainProvider,
                l1Provider,
                offchainDataProvider,
                defaultFeeRate,
                batch
            )).to.eventually.be.rejectedWith('batch is already verified, should not verify again')
        })
    })

    describe('test for withdrawing', () => {

        it.skip('api.createWithdrawal with 1~256 withdrawals should work when the batch should be created on L1', async () => {
            // it's too slow, so we skip it
            for (let i = 1; i <= 256; i++) {
                console.log(`testWithdraw ${i}`)
                await testWithdraw(i)
            }
        })
        it('api.createWithdrawal with 1~256(run 10 random) withdrawals should work when the batch should be created on L1', async () => {
            for (let i = 0; i < 10; i++) {
                const withdrawalCount = Math.floor(Math.random() * 256) + 1
                console.log(`testWithdraw with ${withdrawalCount} withdrawals`)
                await testWithdraw(withdrawalCount)
            }
        })

        async function testWithdraw(
            withdrawalCount: number,
        ) {
            await doADeposit(BigInt(1e8))
            const withdrawals: Withdrawal[] = []
            for (let i = 0; i < withdrawalCount; i++) {
                withdrawals.push(createAMockWithdrawal(BigInt(500 + i), await getRandomL1Address()))
            }

            let batch: WithdrawalBatch = {
                status: 'CLOSED',
                id: 0n,
                withdrawals,
                hash: '0x123',  // dummy l2 hash
                closeWithdrawalBatchTx: { hash: '0x123', status: 'SUCCEEDED', type: 'l2tx' }    // dummy l2 tx
            }
            const initialExpanderTx = await api.createWithdrawal(
                operatorSigner,
                l1Network,
                defaultUtxoProvider,
                defaultChainProvider,
                l1Provider,
                offchainDataProvider,
                defaultFeeRate,
                batch
            )
            l1Provider.setListUtxosByRawTxs([await defaultChainProvider.getRawTransaction(initialExpanderTx)])
            expect(initialExpanderTx).to.equal(await offchainDataProvider.getLatestBridgeTxid())

            batch = {
                ...batch,
                status: 'BEING_EXPANDED',
                withdrawBatchTx: { hash: initialExpanderTx, status: 'MINED', blockNumber: 1, type: 'l1tx' },
                expansionTxs: []
            }

            while(true) {
                if (api.shouldExpand(batch)) {
                    const expanderTxids = await api.expandLevelWithdrawals(
                        operatorSigner,
                        l1Network,
                        createEnhancedUtxoProvider(),
                        l1Provider,
                        offchainDataProvider,
                        defaultFeeRate,
                        batch
                    )
                    batch.expansionTxs.push(expanderTxids.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
                    const rawtxs = await Promise.all(expanderTxids.map(v => defaultChainProvider.getRawTransaction(v)))
                    l1Provider.setListUtxosByRawTxs(rawtxs)
                }
                if (api.shouldDistribute(batch)) {
                    const distributeTxids = await api.distributeLevelWithdrawals(
                        operatorSigner,
                        l1Network,
                        createEnhancedUtxoProvider(),
                        l1Provider,
                        offchainDataProvider,
                        defaultFeeRate,
                        batch
                    )
                    batch.expansionTxs.push(distributeTxids.map(txid => ({ hash: txid, status: 'MINED', blockNumber: 1, type: 'l1tx' })))
                    const rawtxs = await Promise.all(distributeTxids.map(v => defaultChainProvider.getRawTransaction(v)))
                    l1Provider.setListUtxosByRawTxs(rawtxs)
                    break;
                }
            }

            for (let withdrawal of batch.withdrawals) {
                const utxos = await l1Provider.listUtxos(utils.p2trLockingScriptToAddr(withdrawal.recipient, l1Network))
                expect(utxos.length).to.equal(1)
                expect(utxos[0].script).to.equal(withdrawal.recipient)
                expect(utxos[0].satoshis).to.equal(Number(withdrawal.amount))
            }

            l1Provider.setListUtxosByRawTxs([await defaultChainProvider.getRawTransaction(initialExpanderTx)])
        }
    })

    async function getRandomL1Address(): Promise<L1Address> {
        const key = ECPair.makeRandom()
        const signer = new DefaultSigner(key)
        const address = await signer.getAddress()
        const script = utils.addressToScript(address)
        return script as L1Address;
    }

    function createAMockWithdrawal(amount: bigint, address: L1Address){
        const withdrawal: Withdrawal = {
            amount,
            recipient: address,
            origin: '0x123',
            blockNumber: 1
        }
        return withdrawal
    }

    async function doADeposit(amount: bigint){
        let batch: DepositBatch = {
            status: 'BEING_AGGREGATED',
            deposits: await createDeposits(1, offchainDataProvider, [amount]),
            aggregationTxs: []
        }
        const txid = await api.finalizeDepositBatchOnL1(
            operatorSigner,
            l1Network,
            defaultUtxoProvider,
            defaultChainProvider,
            l1Provider,
            offchainDataProvider,
            defaultFeeRate,
            batch
        )
        l1Provider.setListUtxosByRawTxs([await defaultChainProvider.getRawTransaction(txid)])
        batch = {
            ...batch,
            status: 'DEPOSITED',
            finalizeBatchTx: {
                type: 'l1tx',
                hash: txid,
                status: 'MINED',
                blockNumber: 1
            },
            depositTx: {
                type: 'l2tx',
                hash: txid,
                status: 'SUCCEEDED',
            }
        }
        const txid2 = await api.finalizeDepositBatchOnL2(
            operatorSigner,
            l1Network,
            defaultUtxoProvider,
            defaultChainProvider,
            l1Provider,
            offchainDataProvider,
            defaultFeeRate,
            batch
        )
        l1Provider.setListUtxosByRawTxs([await defaultChainProvider.getRawTransaction(txid2)])
        batch = {
            ...batch,
            status: 'COMPLETED',
            verifyTx: {
                type: 'l1tx',
                hash: txid2,
                status: 'MINED',
                blockNumber: 1
            }
        }
        return batch
    }

    async function getRawTxs(txids: L1TxHash[], chainProvider: ChainProvider) {
        let rawTxs = []
        for (const txid of txids) {
            rawTxs.push(await chainProvider.getRawTransaction(txid))
        }
        return rawTxs
    }
    async function createDeposits(
        depositCount: number,
        offchainDataProvider: OffchainDataProvider,
        amountList?: bigint[]
    ) {
        const deposits = []
        amountList = amountList ?? [];
        for (let i = 0; i < depositCount; i++) {
            amountList[i] = amountList[i] ?? (500n + BigInt(i))
        }
        for (let i = 0; i < depositCount; i++) {
            deposits.push(await api.createDeposit(operatorSigner, l1Network, defaultUtxoProvider, defaultChainProvider, offchainDataProvider, defaultFeeRate, operatorSigner, l2Addresses[i % l2Addresses.length], amountList[i]))
        }
        return deposits
    }

})
