import { BridgeCovenant, getContractScriptPubKeys, Signer, TraceableDepositAggregatorUtxo, utils, BATCH_MERKLE_TREE_LENGTH, BridgeState, TraceableBridgeUtxo, SupportedNetwork, UtxoProvider, ChainProvider, TraceableWithdrawalExpanderUtxo, WithdrawalMerkle, Withdrawal as L1Withdrawal, withdrawFeatures } from "l1";
import { Deposit, DepositBatch, L1TxHash, L1TxStatus, L2Address, WithdrawalBatch } from "../state";
import { PubKey, Sha256, UTXO } from 'scrypt-ts'
import { bridgeFeatures, depositFeatures } from "l1";
import { calculateDepositState, checkDepositBatch, getDepositBatchHeight, getDepositBatchID, l2AddressToHex, getContractAddresses } from "./utils/contractUtil";
import { UNCONFIRMED_BLOCK_NUMBER, L1Provider, DEFAULT_FROM_BLOCK, DEFAULT_TO_BLOCK, Utxo } from "./deps/l1Provider";
import { OffchainDataProvider } from "./deps/offchainDataProvider";
import { CONTRACT_INDEXES, WithdrawalExpanderCovenant, WithdrawalExpanderState } from "l1";
import { Transaction } from "@scrypt-inc/bitcoinjs-lib";

async function checkBridgeUtxo(
    offchainDataProvider: OffchainDataProvider,
    l1Provider: L1Provider,
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
) {
    const latestBridgeTxid = await offchainDataProvider.getLatestBridgeTxid();
    if (!latestBridgeTxid) {
        throw new Error('latest bridge txid not found');
    }
    const addresses = await getContractAddresses(operatorSigner, l1Network);
    const bridgeUtxos = await l1Provider.listUtxos(addresses.bridge, DEFAULT_FROM_BLOCK, DEFAULT_TO_BLOCK);
    const bridgeUtxo = bridgeUtxos.find((utxo: Utxo) => utxo.txId === latestBridgeTxid);
    if (!bridgeUtxo) {
        throw new Error('bridge utxo not found');
    }
    const bridgeState: BridgeState = await offchainDataProvider.getBridgeState(latestBridgeTxid) as any
    if (!bridgeState) {
        throw new Error('bridge state not found');
    }
    if (bridgeState.merkleTree.length !== BATCH_MERKLE_TREE_LENGTH) {
        throw new Error(`bridge state merkle tree length is not ${BATCH_MERKLE_TREE_LENGTH}`);
    }
    return [
        bridgeUtxo, bridgeState, latestBridgeTxid
    ] as const
}

export async function createBridgeContractIfNotExists(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,
    offchainDataProvider: OffchainDataProvider, 
    l1Provider: L1Provider,
    feeRate: number,
    logTxids: boolean = true
) {
    const operatorPubKey = await operatorSigner.getPublicKey();
    const addresses = await getContractAddresses(operatorSigner, l1Network);

    let shouldCreateBridge = false;
    const latestBridgeTxid = await offchainDataProvider.getLatestBridgeTxid();
    if (latestBridgeTxid) {
        const utxos = await l1Provider.listUtxos(addresses.bridge);
        const findUtxo = utxos.find((utxo: Utxo) => utxo.txId === latestBridgeTxid);
        shouldCreateBridge = findUtxo ? false : true;
    } else {
        shouldCreateBridge = true;
    }

    if (!shouldCreateBridge) {
        return latestBridgeTxid as L1TxHash;
    }

    const { txid, state } = await bridgeFeatures.deployBridge(
        PubKey(operatorPubKey),
        operatorSigner,
        l1Network,
        utxoProvider,
        chainProvider,
        feeRate
    )
    if (logTxids) {
        console.log('prev bridge txid', latestBridgeTxid)
        console.log('deployBridge txid', txid)
    }
    await offchainDataProvider.setLatestBridgeTxid(txid as L1TxHash);
    await offchainDataProvider.setBridgeState(txid as L1TxHash, state.batchesRoot, state.merkleTree, state.depositAggregatorSPK);

    return txid as L1TxHash;
}

/// list all deposits from l1
export async function listDeposits(
    fromBlock: number,
    toBlock: number,
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    l1Provider: L1Provider,
    offchainDataProvider: OffchainDataProvider
): Promise<Deposit[]> {
    // console.log(`listDeposits(${fromBlock}, ${toBlock})`)
    // query utxo(address = depositAggregator) from node;
    const addresses = await getContractAddresses(operatorSigner, l1Network);
    const utxos = await l1Provider.listUtxos(addresses.depositAggregator, fromBlock, toBlock);
    let deposits: Deposit[] = [];
    for (const utxo of utxos) {
        const depositInfo = await offchainDataProvider.getDepositInfo(utxo.txId as L1TxHash);
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
    offchainDataProvider: OffchainDataProvider,

    feeRate: number,

    userL1Signer: Signer,
    l2Address: L2Address,
    depositAmt: bigint,
): Promise<Deposit> {
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
    await offchainDataProvider.setDepositInfo(deposit.origin.hash, deposit.recipient, deposit.amount);
    // console.log(`createDeposit(signer,${l2Address}, ${depositAmt}) done, txid: ${deposit.origin.hash}`)
    return deposit;
}

/// aggregate 1 level deposit batch
export async function aggregateLevelDeposits(
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
    l1Provider: L1Provider,
    offchainDataProvider: OffchainDataProvider,

    feeRate: number,

    batch: DepositBatch,
): Promise<L1TxHash> {
    // console.log(`finalizeDepositBatchOnL1(batch)`)
    checkDepositBatch(batch.deposits);

    if ((batch as DepositBatch & { status: 'FINALIZED' }).finalizeBatchTx) {
        throw new Error('batch is already finalized, should not finalize again');
    }


    const operatorPubKey = await operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));
    const [bridgeUtxo, bridgeState] = await checkBridgeUtxo(offchainDataProvider, l1Provider, operatorSigner, l1Network);
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

    await offchainDataProvider.setLatestBridgeTxid(res.txid as L1TxHash);
    await offchainDataProvider.setBridgeState(res.txid as L1TxHash, res.state.batchesRoot, res.state.merkleTree, res.state.depositAggregatorSPK);
    // console.log(`finalizeDepositBatchOnL1(batch) done, txid: ${res.txid}`)
    return res.txid as L1TxHash;
}

/// verify the deposit batch on l1
export async function finalizeDepositBatchOnL2(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,
    l1Provider: L1Provider,
    offchainDataProvider: OffchainDataProvider,

    feeRate: number,

    batch: DepositBatch,
): Promise<L1TxHash> {
    // console.log(`finalizeDepositBatchOnL2(batch)`)
    checkDepositBatch(batch.deposits);

    const operatorPubKey = await operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));    

    const [bridgeUtxo, bridgeState] = await checkBridgeUtxo(offchainDataProvider, l1Provider, operatorSigner, l1Network);

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

/// get the status of a l1 transaction
export function getL1TransactionStatus(
    l1Provider: L1Provider,
    txid: L1TxHash,
): Promise<L1TxStatus['status']> {
    // console.log(`getL1TransactionStatus(${txid})`)
    return l1Provider.getTransactionStatus(txid);
}

/// get the current block number of l1
export function getL1CurrentBlockNumber(
    l1Provider: L1Provider,
): Promise<number> {
    // console.log(`getL1CurrentBlockNumber()`)
    return l1Provider.getCurrentBlockNumber();
}

/*
withdrawal batch state
pending: is accepting new withdrawals
closeWithdrawalBatchSubmitted: is closing the withdrawal batch on l2
closed: is closed on l2
submittedForExpansion: is submitted for expansion on l1
beingExpanded: is being expanded or distributed on l1
expanded: is distributed on l1
*/

export async function createWithdrawal(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,
    l1Provider: L1Provider,
    offchainDataProvider: OffchainDataProvider,
    feeRate: number,
    batch: WithdrawalBatch,
): Promise<L1TxHash> {

    // 1. verify the batch is valid
    if (
        batch.status !== 'CLOSED'
    ) {
        throw new Error('for withdrawBatchOnL1, batch status must be CLOSED');
    }
    if (batch.withdrawals.length === 0) {
        throw new Error('for withdrawBatchOnL1, batch must have withdrawals');
    }

    // 2. build tx
    const [bridgeUtxo, bridgeState] = await checkBridgeUtxo(offchainDataProvider, l1Provider, operatorSigner, l1Network);
    const operatorPubKey = await operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

    const res = await bridgeFeatures.createWithdrawalExpander(
        operatorSigner,
        l1Network,
        utxoProvider,
        chainProvider,

        {
            operator: PubKey(operatorPubKey),
            expanderSPK: spks.withdrawExpander,
            state: bridgeState,
            utxo: bridgeUtxo,
        },
        batch.withdrawals.map(withdrawal => ({
            l1Address: withdrawal.recipient,
            amt: withdrawal.amount,
        })),
        feeRate,
    );
    await offchainDataProvider.setLatestBridgeTxid(res.txid as L1TxHash);
    await offchainDataProvider.setBridgeState(res.txid as L1TxHash, res.bridgeState.batchesRoot, res.bridgeState.merkleTree, res.bridgeState.depositAggregatorSPK);
    // console.log(`createWithdrawal(batch) done, txid: ${res.txid}`)
    return res.txid as L1TxHash;
}

export function shouldExpand(batch: WithdrawalBatch): boolean {
    if (
        batch.status !== 'SUBMITTED_FOR_EXPANSION' &&
        batch.status !== 'BEING_EXPANDED'
    ) return false;

    // just distribute for level <= 2
    const height = Math.ceil(Math.log2(batch.withdrawals.length));
    if (height <= WithdrawalExpanderCovenant.MAX_LEVEL_FOR_DISTRIBUTE) return false;

    // expanding is not started, return true
    if (batch.status === 'SUBMITTED_FOR_EXPANSION') return true;

    const currentExpandCount = batch.expansionTxs.length;
    
    // expanding is started, return false
    return height > currentExpandCount + Number(WithdrawalExpanderCovenant.MAX_LEVEL_FOR_DISTRIBUTE);
}

export function shouldDistribute(batch: WithdrawalBatch): boolean {
    if (
        batch.status !== 'SUBMITTED_FOR_EXPANSION' &&
        batch.status !== 'BEING_EXPANDED'
    ) return false;
    return !shouldExpand(batch)
}

async function parseDataFromBatch(
    operatorSigner: Signer,
    batch: WithdrawalBatch,
    offchainDataProvider: OffchainDataProvider,
    l1Provider: L1Provider,
    chainProvider: ChainProvider,
    l1Network: SupportedNetwork,
): Promise<{
    withdrawals: L1Withdrawal[],
    expanderTxs: Transaction[],
    expanderUtxos: UTXO[],
    stateHashes: Sha256[],
    expanderStates: WithdrawalExpanderState[],
}> { 
    if (
        batch.status !== 'SUBMITTED_FOR_EXPANSION' &&
        batch.status !== 'BEING_EXPANDED'
    ) {
        return {
            withdrawals: [],
            expanderTxs: [],
            expanderUtxos: [],
            stateHashes: [],
            expanderStates: [],
        }
    }
    const operatorPubKey = await operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

    const expanderTxs: Transaction[] = []
    const expanderUtxos: UTXO[] = [];
    const stateHashes: Sha256[] = [];
    const expanderStates: WithdrawalExpanderState[] = [];
    const withdrawals = batch.withdrawals.map(withdrawal => ({
        l1Address: withdrawal.recipient,
        amt: withdrawal.amount,
    }));
    if (batch.status === 'SUBMITTED_FOR_EXPANSION') {
        const [_1, _2, latestBridgeTxid] = await checkBridgeUtxo(offchainDataProvider, l1Provider, operatorSigner, l1Network);
        const bridgeRawtx = await chainProvider.getRawTransaction(latestBridgeTxid);
        const tx = Transaction.fromHex(bridgeRawtx);
        expanderTxs.push(tx);
        expanderUtxos.push(...utils.getUtxoByScript(tx, spks.withdrawExpander));
        const hash = Sha256(utils.splitHashFromStateOutput(tx)[1])
        stateHashes.push(hash);
        expanderStates.push(WithdrawalMerkle.getStateForHash(withdrawals, hash));
    } else {
        if (batch.expansionTxs.length === 0) {
            throw new Error('for expandLevelWithdrawals, batch must have expansion txs');
        }
        const levelTxs = batch.expansionTxs.at(-1)!;
        for (const ltx of levelTxs) {
            const rawtx = await chainProvider.getRawTransaction(ltx.hash);
            const tx = Transaction.fromHex(rawtx);
            expanderTxs.push(tx);
            const utxos = utils.getUtxoByScript(tx, spks.withdrawExpander);
            expanderUtxos.push(...utxos);
            for (const utxo of utxos) {
                const hash = Sha256(
                    utils.splitHashFromStateOutput(tx)[utxo.outputIndex === CONTRACT_INDEXES.outputIndex.withdrawalExpander.inDepositAggregatorTx.first ?  0 : 1]
                );
                stateHashes.push(hash);
                expanderStates.push(WithdrawalMerkle.getStateForHash(withdrawals, hash));
            }
        }
    }
    const isSameLevel = expanderStates.every(state => state.level === expanderStates[0].level);
    if (!isSameLevel) {
        throw new Error('for expandLevelWithdrawals, all the level must be the same');
    }
    // verify all the level withdrawalExpanders is not spent
    {
        const addresses = await getContractAddresses(operatorSigner, l1Network);
        const onchainExpanderUtxos = await l1Provider.listUtxos(addresses.withdrawExpander, DEFAULT_FROM_BLOCK, DEFAULT_TO_BLOCK);
        const onchainUtxoIds = onchainExpanderUtxos.map(utxo => `${utxo.txId}:${utxo.outputIndex}`);
        for (const utxo of expanderUtxos) {
            const id = `${utxo.txId}:${utxo.outputIndex}`;
            if (!onchainUtxoIds.includes(id)) {
                throw new Error(`for expandLevelWithdrawals, the withdrawalExpander(${id}) is spent`);
            }
        }
    }
    return {
        withdrawals,
        expanderTxs,
        expanderUtxos,
        stateHashes,
        expanderStates,
    }
}

export async function expandLevelWithdrawals(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,
    l1Provider: L1Provider,
    offchainDataProvider: OffchainDataProvider,

    feeRate: number,
    batch: WithdrawalBatch,
) {
    // verify the batch is valid or ready to expand
    if (
        batch.status !== 'SUBMITTED_FOR_EXPANSION' &&
        batch.status !== 'BEING_EXPANDED'
    ) {
        throw new Error('for expandLevelWithdrawals, batch status must be SUBMITTED_FOR_EXPANSION or BEING_EXPANDED');
    }   
    if (!shouldExpand(batch)) {
        throw new Error('should distribute now');
    }

    const operatorPubKey = await operatorSigner.getPublicKey();

    const { withdrawals, expanderUtxos, expanderStates } = await parseDataFromBatch(operatorSigner, batch, offchainDataProvider, l1Provider, chainProvider, l1Network);
    
    let txs: L1TxHash[] = [];

    for (let i = 0; i < expanderUtxos.length; i++) {
        const utxo = expanderUtxos[i];
        const state = expanderStates[i];
        const traceableUtxo: TraceableWithdrawalExpanderUtxo = {
            operator: PubKey(operatorPubKey),
            state: state,
            utxo: utxo,
        };
        const res = await withdrawFeatures.expandWithdrawal(
            operatorSigner,
            l1Network,
            utxoProvider,
            chainProvider,

            traceableUtxo,
            withdrawals,

            feeRate,
        );
        txs.push(res.txid as L1TxHash);
    }
    return txs
}

export async function distributeWithdrawal(
    operatorSigner: Signer,
    l1Network: SupportedNetwork,
    utxoProvider: UtxoProvider,
    chainProvider: ChainProvider,
    l1Provider: L1Provider,
    offchainDataProvider: OffchainDataProvider,

    feeRate: number,
    batch: WithdrawalBatch,
) {
    // verify the batch is valid or ready to distribute
    if (
        batch.status !== 'SUBMITTED_FOR_EXPANSION' &&
        batch.status !== 'BEING_EXPANDED'
    ) {
        throw new Error('for distributeWithdrawal, batch status must be SUBMITTED_FOR_EXPANSION or BEING_EXPANDED');
    }
    if (!shouldDistribute(batch)) {
        throw new Error('should expand now');
    }

    const operatorPubKey = await operatorSigner.getPublicKey();
    
    // build the txs
    const { withdrawals, expanderUtxos, expanderStates } = await parseDataFromBatch(operatorSigner, batch, offchainDataProvider, l1Provider, chainProvider, l1Network);
    let txs: L1TxHash[] = [];
    for (let i = 0; i < expanderUtxos.length; i++) {
        const utxo = expanderUtxos[i];
        const state = expanderStates[i];
        const traceableUtxo: TraceableWithdrawalExpanderUtxo = {
            operator: PubKey(operatorPubKey),
            state: state,
            utxo: utxo,
        };
        const res = await withdrawFeatures.distributeWithdrawals(
            operatorSigner,
            l1Network,
            utxoProvider,
            chainProvider,

            traceableUtxo,
            withdrawals,

            feeRate,
        );
        txs.push(res.txid as L1TxHash);
    }
}