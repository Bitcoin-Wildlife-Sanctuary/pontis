import { BridgeCovenant, DepositAggregatorCovenant, getContractScriptPubKeys, Signer, TraceableDepositAggregatorUtxo, utils, BridgeMerkle, BatchMerkleTree, BATCH_MERKLE_TREE_LENGTH, BridgeState, TraceableBridgeUtxo } from "l1";   
import { Deposit, DepositBatch, L1TxHash, L1TxStatus, L2Address } from "../state";
import { PubKey, Sha256 } from 'scrypt-ts'
import {  bridgeFeatures, depositFeatures } from "l1";
import * as env from "./env";
import { calculateDepositState, checkDepositBatch, getDepositBatchHeight, getDepositBatchID } from "./utils/contractUtil";
import { listUtxos, UNCONFIRMED_BLOCK_NUMBER, getTransactionStatus, getCurrentBlockNumber } from "./utils/chain";
import { getOffChainDB } from "./utils/offchain";


/// list all deposits from l1
export async function listDeposits(
    fromBlock: number,
    toBlock: number,
): Promise<Deposit[]> {
    // query utxo(address = depositAggregator) from node;
    const offChainDB = getOffChainDB();
    const operatorPubKey = await env.operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));
    // transfer scriptPubKey to address
    const address = spks.depositAggregator;
    const utxos = await listUtxos(utils.p2trLockingScriptToAddr(address, env.l1Network), fromBlock, toBlock);
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
    userL1Signer: Signer,
    l2Address: L2Address,
    depositAmt: bigint,
): Promise<Deposit>{
    const operatorPubKey = await env.operatorSigner.getPublicKey();
    const depositTx = await depositFeatures.createDeposit(
        PubKey(operatorPubKey),
        userL1Signer,
        env.l1Network,
        env.createUtxoProvider(),
        env.createChainProvider(),
        l2Address,
        depositAmt,

        env.l1FeeRate
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
    const offChainDB = getOffChainDB();
    await offChainDB.setDepositInfo(deposit.origin.hash, deposit.recipient, deposit.amount);
    return deposit;
}

/// aggregate 1 level deposit batch
export async function aggregateDeposits(
    batch: DepositBatch,
): Promise<L1TxHash[]> {
    
    const utxoProvider = env.createUtxoProvider();
    const chainProvider = env.createChainProvider();
    const operatorPubKey = await env.operatorSigner.getPublicKey();
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
            env.operatorSigner,
            env.l1Network,
            utxoProvider,
            chainProvider,

            traceableUtxos[i],
            traceableUtxos[i + 1],
            env.l1FeeRate,
        );
        txs.push(tx.txid as L1TxHash);
    }
    return txs;
}

/// finalize a deposit batch on l1
export async function finalizeDepositBatchOnL1(
    batch: DepositBatch,
): Promise<L1TxHash> {

    checkDepositBatch(batch.deposits);

    const utxoProvider = env.createUtxoProvider();
    const chainProvider = env.createChainProvider();
    const offChainDB = getOffChainDB();

    const operatorPubKey = await env.operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));
    const bridgeUtxos = await listUtxos(utils.p2trLockingScriptToAddr(spks.bridge, env.l1Network));
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

    const height = getDepositBatchHeight(batch.deposits);
    if (height !== batch.aggregationTxs.length) {
        throw new Error('deposits are being aggregated');
    }
    const lastLevelAggs = batch.aggregationTxs.at(-1)!;
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
        env.operatorSigner,
        env.l1Network,
        utxoProvider,
        chainProvider,

        traceableBridgeUtxo,
        traceableDepositAggregatorUtxo,
        env.l1FeeRate,
    );

    await offChainDB.setLatestBridgeTxid(res.txid as L1TxHash);
    await offChainDB.setBridgeState(res.txid as L1TxHash, res.state.toString(), res.state.merkleTree, res.state.depositAggregatorSPK);
    return res.txid as L1TxHash;
}

/// verify the deposit batch on l1
export async function finalizeDepositBatchOnL2(
    batch: DepositBatch,
): Promise<L1TxHash> {
    checkDepositBatch(batch.deposits);

    const utxoProvider = env.createUtxoProvider();
    const chainProvider = env.createChainProvider();
    const offChainDB = getOffChainDB();

    const operatorPubKey = await env.operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

    const bridgeUtxos = await listUtxos(utils.p2trLockingScriptToAddr(spks.bridge, env.l1Network));
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
    const batchProof = BridgeMerkle.getMerkleProof(bridgeState.merkleTree as BatchMerkleTree, batchIDIndex);
    const bridgeTraceableUtxo: TraceableBridgeUtxo = {
        operator: PubKey(operatorPubKey),
        expanderSPK: spks.withdrawExpander,
        state: bridgeState,
        utxo: bridgeUtxo,
    };
    const res = await bridgeFeatures.finalizeL2Deposit(
        env.operatorSigner,
        env.l1Network,
        utxoProvider,
        chainProvider,

        Sha256(batchID),

        bridgeTraceableUtxo,
        env.l1FeeRate,
    );
    return res.txid as L1TxHash;
}

export function getL1TransactionStatus(txid: L1TxHash): Promise<L1TxStatus['status']> {
    return getTransactionStatus(txid);
}

export function getL1CurrentBlockNumber(): Promise<number> {
    return getCurrentBlockNumber();
}