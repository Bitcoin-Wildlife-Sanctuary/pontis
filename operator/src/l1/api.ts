import { BridgeCovenant, DepositAggregatorCovenant, getContractScriptPubKeys, Signer, TraceableDepositAggregatorUtxo, utils, BridgeMerkle, BatchMerkleTree, BATCH_MERKLE_TREE_LENGTH, BridgeState, TraceableBridgeUtxo, SupportedNetwork, UtxoProvider, ChainProvider } from "l1";   
import { Deposit, DepositBatch, L1TxHash, L1TxStatus, L2Address } from "../state";
import { PubKey, Sha256 } from 'scrypt-ts'
import {  bridgeFeatures, depositFeatures } from "l1";
import * as env from "./env";
import { calculateDepositState, checkDepositBatch, getDepositBatchHeight, getDepositBatchID, l2AddressToHex, getContractAddresses } from "./utils/contractUtil";
import { UNCONFIRMED_BLOCK_NUMBER, L1ChainProvider, DEFAULT_FROM_BLOCK, DEFAULT_TO_BLOCK } from "./utils/chain";
import { OffChainDB } from "./utils/offchain";
/// list all deposits from l1
export async function listDeposits(
    fromBlock: number,
    toBlock: number,
    l1ChainProvider: L1ChainProvider,
    offChainDB: OffChainDB  
): Promise<Deposit[]> {
    // console.log(`listDeposits(${fromBlock}, ${toBlock})`)
    // query utxo(address = depositAggregator) from node;
    const addresses = await getContractAddresses(env.operatorSigner, env.l1Network);
    const utxos = await l1ChainProvider.listUtxos(addresses.depositAggregator, fromBlock, toBlock);
    let deposits: Deposit[] = [];
    for (const utxo of utxos) {
        const depositInfo = await offChainDB.getDepositInfo(utxo.txId as L1TxHash);
        // utxo is deposit utxo or aggregate utxo, here we only care about deposit utxo
        if (depositInfo) {
            deposits.push({
                amount: BigInt(depositInfo.amount),
                recipient: depositInfo.recipient,
                origin: {
                    blockNumber: utxo.blockNumber,
                    status: utxo.blockNumber > UNCONFIRMED_BLOCK_NUMBER ? 'MINED' as const : 'UNCONFIRMED' as const,
                    type: 'l1tx' as const,
                    hash: utxo.txId as L1TxHash,
                },
            });
        }
    }
    return deposits;
}

/// create a single deposit
export async function createDeposit(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,
    offChainDB: OffChainDB,

    feeRate: number,

    userL1Signer: Signer,
    l2Address: L2Address,
    depositAmt: bigint,
): Promise<Deposit>{
    // console.log(`createDeposit(signer,${l2Address}, ${depositAmt})`)
    const operatorPubKey = await operatorSigner.getPublicKey();
    const depositTx = await depositFeatures.createDeposit(
        PubKey(operatorPubKey),
        userL1Signer,
        l1Network,
        utxoProvider,
        chainProvider,
        l2AddressToHex(l2Address),
        depositAmt,

        feeRate
    );
    const deposit: Deposit = {
        amount: depositAmt,
        recipient: l2Address,
        origin: {
            blockNumber: UNCONFIRMED_BLOCK_NUMBER,
            status: 'UNCONFIRMED' as const,
            type: 'l1tx' as const,
            hash: depositTx.txid as L1TxHash,
        },
    }
    await offChainDB.setDepositInfo(deposit.origin.hash, deposit.recipient, deposit.amount);
    // console.log(`createDeposit(signer,${l2Address}, ${depositAmt}) done, txid: ${deposit.origin.hash}`)
    return deposit;
}

/// aggregate 1 level deposit batch
export async function aggregateDeposits(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,

    feeRate: number,

    batch: DepositBatch,
): Promise<L1TxHash[]> {
    // console.log(`aggregateDeposits(batch)`)
    const operatorPubKey = await operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

    const depositCount = batch.deposits.length;
    const height = Math.log2(depositCount);
    if (2 ** height !== depositCount) {
        throw new Error('deposit count is not a power of 2');
    }

    // todo: add level aggregate in l1/features/deposit.ts, to avoid potential fee not enough error 

    if (batch.aggregationTxs.length === height) {
        throw new Error('batch is already aggregated, should finalize to l1 bridge');
    }

    const level = batch.aggregationTxs.length;
    const levelStates = calculateDepositState(batch.deposits, level);
    const levelAggTxids = batch.aggregationTxs.length > 0 ? batch.aggregationTxs.at(-1)!.map(tx => tx.hash) : batch.deposits.map(deposit => deposit.origin.hash);
    const levelAggRawtxs = await Promise.all(levelAggTxids.map(id => chainProvider.getRawTransaction(id)));
    const levelAggUtxos = levelAggRawtxs.map(tx => utils.txToUtxo(tx, 1));

    const traceableUtxos: TraceableDepositAggregatorUtxo[] = levelStates.map((state, index) => ({
        operator: PubKey(operatorPubKey),
        bridgeSPK: spks.bridge,
        state: state,
        utxo: levelAggUtxos[index],
    }));
    
    // merge each two covenants into one tx, by calling aggregateDeposit
    const txs: L1TxHash[] = [];
    for (let i = 0; i < traceableUtxos.length; i += 2) {
        const tx = await depositFeatures.aggregateDeposit(
            operatorSigner,
            l1Network,
            utxoProvider,
            chainProvider,

            traceableUtxos[i],
            traceableUtxos[i + 1],
            feeRate,
        );
        txs.push(tx.txid as L1TxHash);
    }
    // console.log(`aggregateDeposits(batch) done, txids: ${txs.join(', ')}`)
    return txs;
}

/// finalize a deposit batch on l1
export async function finalizeDepositBatchOnL1(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,
    l1ChainProvider: L1ChainProvider,
    offChainDB: OffChainDB,

    feeRate: number,

    batch: DepositBatch,
): Promise<L1TxHash> {
    // console.log(`finalizeDepositBatchOnL1(batch)`)
    checkDepositBatch(batch.deposits);


    const operatorPubKey = await operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));
    const addresses = await getContractAddresses(operatorSigner, l1Network);
    const bridgeUtxos = await l1ChainProvider.listUtxos(addresses.bridge, DEFAULT_FROM_BLOCK, DEFAULT_TO_BLOCK);
    const latestBridgeTxid = await offChainDB.getLatestBridgeTxid();
    if (!latestBridgeTxid) {
        throw new Error('latest bridge txid not found');
    }
    const bridgeUtxo = bridgeUtxos.find(utxo => utxo.txId === latestBridgeTxid);
    if (!bridgeUtxo) {
        // console.log('latestBridgeTxid', latestBridgeTxid)
        throw new Error('bridge utxo not found');
    }

    const bridgeState: BridgeState = await offChainDB.getBridgeState(latestBridgeTxid) as any
    if (!bridgeState) {
        throw new Error('bridge state not found');
    }
    if (bridgeState.merkleTree.length !== BATCH_MERKLE_TREE_LENGTH) {
        throw new Error(`bridge state merkle tree length is not ${BATCH_MERKLE_TREE_LENGTH}`);
    }
    const emptyBatchIDIndex = bridgeState.merkleTree.findIndex(batch => batch === BridgeCovenant.EMPTY_BATCH_ID);
    if (emptyBatchIDIndex === -1) {
        throw new Error('the bridge state batchId is full, please finalizeL2 to clear one batchId');
    }

    const height = getDepositBatchHeight(batch.deposits);
    if (height !== batch.aggregationTxs.length) {
        throw new Error('deposits are being aggregated');
    }
    const lastLevelAggs = height === 0 ? batch.deposits.map(v => v.origin) : batch.aggregationTxs.at(-1)!;
    if (lastLevelAggs.length !== 1) {
        throw new Error('last level aggregation txs is not 1');
    }
    const lastLevelRawtxs = await Promise.all(lastLevelAggs.map(tx => chainProvider.getRawTransaction(tx.hash)));
    const lastLevelUtxos = lastLevelRawtxs.map(tx => utils.txToUtxo(tx, 1));
    const lastLevelStates = calculateDepositState(batch.deposits, height);
    const traceableBridgeUtxo: TraceableBridgeUtxo = {
        operator: PubKey(operatorPubKey),
        expanderSPK: spks.withdrawExpander,
        state: bridgeState,
        utxo: bridgeUtxo,
    };
    const traceableDepositAggregatorUtxo: TraceableDepositAggregatorUtxo = {
        operator: PubKey(operatorPubKey),
        bridgeSPK: spks.bridge,
        state: lastLevelStates[0],
        utxo: lastLevelUtxos[0],
    };
    const res = await bridgeFeatures.finalizeL1Deposit(
        operatorSigner,
        l1Network,
        utxoProvider,
        chainProvider,

        traceableBridgeUtxo,
        traceableDepositAggregatorUtxo,
        feeRate,
    );

    await offChainDB.setLatestBridgeTxid(res.txid as L1TxHash);
    await offChainDB.setBridgeState(res.txid as L1TxHash, res.state.batchesRoot, res.state.merkleTree, res.state.depositAggregatorSPK);
    // console.log(`finalizeDepositBatchOnL1(batch) done, txid: ${res.txid}`)
    return res.txid as L1TxHash;
}

/// verify the deposit batch on l1
export async function finalizeDepositBatchOnL2(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,
    l1ChainProvider: L1ChainProvider,
    offChainDB: OffChainDB,

    feeRate: number,

    batch: DepositBatch,
): Promise<L1TxHash> {
    // console.log(`finalizeDepositBatchOnL2(batch)`)
    checkDepositBatch(batch.deposits);

    const operatorPubKey = await operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));
    const addresses = await getContractAddresses(operatorSigner, l1Network);
    const bridgeUtxos = await l1ChainProvider.listUtxos(addresses.bridge, DEFAULT_FROM_BLOCK, DEFAULT_TO_BLOCK);
    const latestBridgeTxid = await offChainDB.getLatestBridgeTxid();
    if (!latestBridgeTxid) {
        throw new Error('latest bridge txid not found');
    }
    const bridgeUtxo = bridgeUtxos.find(utxo => utxo.txId === latestBridgeTxid);

    if (!bridgeUtxo) {
        throw new Error('bridge utxo not found');
    }

    const bridgeState: BridgeState = await offChainDB.getBridgeState(latestBridgeTxid) as any
    if (!bridgeState) {
        throw new Error('bridge state not found');
    }
    if (bridgeState.merkleTree.length !== BATCH_MERKLE_TREE_LENGTH) {
        throw new Error(`bridge state merkle tree length is not ${BATCH_MERKLE_TREE_LENGTH}`);
    }
    const emptyBatchIDIndex = bridgeState.merkleTree.findIndex(batch => batch === BridgeCovenant.EMPTY_BATCH_ID);
    if (emptyBatchIDIndex === -1) {
        throw new Error('the bridge state batchId is full, please finalizeL2 to clear one batchId');
    }

    const batchID = getDepositBatchID(batch);
    const batchIDIndex = bridgeState.merkleTree.findIndex(batch => batch === batchID);
    if (batchIDIndex === -1) {
        throw new Error('batch id not found');
    }
    const bridgeTraceableUtxo: TraceableBridgeUtxo = {
        operator: PubKey(operatorPubKey),
        expanderSPK: spks.withdrawExpander,
        state: bridgeState,
        utxo: bridgeUtxo,
    };
    const res = await bridgeFeatures.finalizeL2Deposit(
        operatorSigner,
        l1Network,
        utxoProvider,
        chainProvider,

        Sha256(batchID),

        bridgeTraceableUtxo,
        feeRate,
    );
    // console.log(`finalizeDepositBatchOnL2(batch) done, txid: ${res.txid}`)
    return res.txid as L1TxHash;
}

export function getL1TransactionStatus(
    l1ChainProvider: L1ChainProvider,
    txid: L1TxHash,
): Promise<L1TxStatus['status']> {
    // console.log(`getL1TransactionStatus(${txid})`)
    return l1ChainProvider.getTransactionStatus(txid);
}

export function getL1CurrentBlockNumber(
    l1ChainProvider: L1ChainProvider,
): Promise<number> {
    // console.log(`getL1CurrentBlockNumber()`)
    return l1ChainProvider.getCurrentBlockNumber();
}