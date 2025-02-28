import {
  BridgeCovenant,
  getContractScriptPubKeys,
  Signer,
  TraceableDepositAggregatorUtxo,
  utils,
  BATCH_MERKLE_TREE_LENGTH,
  BridgeState,
  TraceableBridgeUtxo,
  SupportedNetwork,
  UtxoProvider,
  ChainProvider,
  TraceableWithdrawalExpanderUtxo,
  WithdrawalMerkle,
  Withdrawal as L1Withdrawal,
  withdrawFeatures,
  EnhancedProvider,
  DepositAggregatorCovenant,
  bridgeFeatures,
  depositFeatures,
  BatchId,
  WithdrawalNode,
  ExpansionMerkleTree,
} from 'l1';
import {
  BridgeCovenantState,
  Deposit,
  DepositAggregationState,
  DepositBatch,
  L1Tx,
  L1TxHash,
  L1TxStatus,
  L2Address,
  WithdrawalBatch,
} from '../state';
import { ByteString, PubKey, Sha256, UTXO } from 'scrypt-ts';
import { l2AddressToHex, getContractAddresses } from './utils/contractUtil';
import {
  UNCONFIRMED_BLOCK_NUMBER,
  L1Provider,
  DEFAULT_FROM_BLOCK,
  DEFAULT_TO_BLOCK,
  Utxo,
} from './deps/l1Provider';
import { OffchainDataProvider } from './deps/offchainDataProvider';
import {
  CONTRACT_INDEXES,
  WithdrawalExpanderCovenant,
  WithdrawalExpanderState,
} from 'l1';
import { Transaction } from '@scrypt-inc/bitcoinjs-lib';
import { assert } from 'console';

async function checkBridgeUtxo(
  offchainDataProvider: OffchainDataProvider,
  l1Provider: L1Provider,
  operatorSigner: Signer,
  l1Network: SupportedNetwork
) {
  const latestBridgeTxid = await offchainDataProvider.getLatestBridgeTxid();
  if (!latestBridgeTxid) {
    throw new Error('latest bridge txid not found');
  }
  const addresses = await getContractAddresses(operatorSigner, l1Network);
  const bridgeUtxos = await l1Provider.listUtxos(
    addresses.bridge,
    DEFAULT_FROM_BLOCK,
    DEFAULT_TO_BLOCK
  );
  const bridgeUtxo = bridgeUtxos.find(
    (utxo: Utxo) => utxo.txId === latestBridgeTxid
  );
  if (!bridgeUtxo) {
    throw new Error('bridge utxo not found');
  }
  const bridgeState: BridgeState = (await offchainDataProvider.getBridgeState(
    latestBridgeTxid
  )) as any;
  if (!bridgeState) {
    throw new Error('bridge state not found');
  }
  if (bridgeState.merkleTree.length !== BATCH_MERKLE_TREE_LENGTH) {
    throw new Error(
      `bridge state merkle tree length is not ${BATCH_MERKLE_TREE_LENGTH}`
    );
  }
  return [bridgeUtxo, bridgeState, latestBridgeTxid] as const;
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
  );
  if (logTxids) {
    console.log('prev bridge txid', latestBridgeTxid);
    console.log('deployBridge txid', txid);
  }
  await offchainDataProvider.setLatestBridgeTxid(txid as L1TxHash);
  await offchainDataProvider.setBridgeState(
    txid as L1TxHash,
    state.batchesRoot,
    state.merkleTree,
    state.depositAggregatorSPK
  );

  return txid as L1TxHash;
}

export async function createBridgeContract(
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,
  feeRate: number
): Promise<BridgeCovenantState> {
  const operatorPubKey = await operatorSigner.getPublicKey();

  const { txid, state } = await bridgeFeatures.deployBridge(
    PubKey(operatorPubKey),
    operatorSigner,
    l1Network,
    utxoProvider,
    chainProvider,
    feeRate
  );

  return {
    ...state,
    latestTx: {
      type: 'l1tx',
      status: 'UNCONFIRMED',
      hash: txid,
    },
  };
}

/// list all deposits from l1
export async function listDeposits(
  fromBlock: number,
  toBlock: number,
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  l1Provider: L1Provider,
  chainProvider: ChainProvider
): Promise<Deposit[]> {
  // console.log(`listDeposits(${fromBlock}, ${toBlock})`)
  // query utxo(address = depositAggregator) from node;
  const addresses = await getContractAddresses(operatorSigner, l1Network);
  const utxos = await l1Provider.listUtxos(
    addresses.depositAggregator,
    fromBlock,
    toBlock
  );
  let deposits: Deposit[] = [];
  for (const utxo of utxos) {
    const tx = await chainProvider.getRawTransaction(utxo.txId as L1TxHash);
    const [isInitialDeposit, depositData] =
      DepositAggregatorCovenant.parseDepositInfoFromTx(Transaction.fromHex(tx));
    if (isInitialDeposit) {
      deposits.push({
        amount: depositData.amount,
        recipient: `0x${depositData.address}`,
        origin: {
          blockNumber: utxo.blockNumber,
          status:
            utxo.blockNumber > UNCONFIRMED_BLOCK_NUMBER
              ? ('MINED' as const)
              : ('UNCONFIRMED' as const),
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
  operatorPubKey: PubKey,
  l1Network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,

  feeRate: number,

  userL1Signer: Signer,
  l2Address: L2Address,
  depositAmt: bigint
): Promise<Deposit> {
  // console.log(`createDeposit(signer,${l2Address}, ${depositAmt})`)
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
      status: 'UNCONFIRMED' as const,
      type: 'l1tx' as const,
      hash: depositTx.txid as L1TxHash,
    },
  };
  // console.log(`createDeposit(signer,${l2Address}, ${depositAmt}) done, txid: ${deposit.origin.hash}`)
  return deposit;
}

export async function createDepositWithoutSigning(
  operatorPubKey: PubKey,
  l1Network: SupportedNetwork,
  utxoProvider: UtxoProvider,

  feeRate: number,

  userL1Address: string,
  l2Address: L2Address,
  depositAmt: bigint
) {
  const depositTx = await depositFeatures.createDepositWithoutSigning(
    PubKey(operatorPubKey),
    userL1Address,
    l1Network,
    utxoProvider,
    l2AddressToHex(l2Address),
    depositAmt,

    feeRate
  );
  const deposit: Deposit = {
    amount: depositAmt,
    recipient: l2Address,
    origin: {
      status: 'UNCONFIRMED' as const,
      type: 'l1tx' as const,
      hash: depositTx.txid as L1TxHash,
    },
  };
  return {
    deposit,
    psbt: depositTx.psbt.toHex(),
    psbtOptions: depositTx.psbtOptions,
  };
}

export async function shouldAggregate(batch: DepositBatch) {
  const depositCount = batch.deposits.length;
  const height = Math.log2(depositCount);
  if (batch.aggregationTxs.length === height) {
    return false;
  }
  return true;
}

/// aggregate 1 level deposit batch
export async function aggregateLevelDeposits(
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  enhancedUtxoProvider: EnhancedProvider,
  feeRate: number,
  currentLevel: DepositAggregationState[]
): Promise<DepositAggregationState[]> {
  console.log('aggregating level:', currentLevel);

  const operatorPubKey = await operatorSigner.getPublicKey();
  const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

  const levelAggRawtxs = await Promise.all(
    currentLevel.map((s) => enhancedUtxoProvider.getRawTransaction(s.tx.hash))
  );
  const levelAggUtxos = levelAggRawtxs.map((tx) => utils.txToUtxo(tx, 1));

  const traceableUtxos: TraceableDepositAggregatorUtxo[] = currentLevel.map(
    (state, index) => {
      return {
        operator: PubKey(operatorPubKey),
        bridgeSPK: spks.bridge,
        state,
        utxo: levelAggUtxos[index],
      };
    }
  );

  const result: DepositAggregationState[] = [];
  for (let i = 0; i < traceableUtxos.length; i += 2) {
    assert(
      traceableUtxos[i].state.level === traceableUtxos[i + 1].state.level,
      'levels do not match'
    );
    const tx = await depositFeatures.aggregateDeposit(
      operatorSigner,
      l1Network,
      enhancedUtxoProvider,
      enhancedUtxoProvider,
      traceableUtxos[i],
      traceableUtxos[i + 1],
      feeRate
    );
    result.push({
      ...tx.state,
      tx: {
        type: 'l1tx',
        status: 'UNCONFIRMED',
        hash: tx.txid as L1TxHash,
      },
    });
  }

  const broadcastRes = await enhancedUtxoProvider.finalBroadcast();
  if (broadcastRes.failedBroadcastTxError) {
    console.error(`aggregateDeposits(batch), error`);
    console.error(broadcastRes.failedBroadcastTxError);
  }

  return result.filter((r) =>
    broadcastRes.broadcastedTxids.includes(r.tx.hash)
  );
}

type ContractAddressKeys = keyof Awaited<
  ReturnType<typeof getContractAddresses>
>;

async function findUtxo(
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  l1Provider: L1Provider,
  address: ContractAddressKeys,
  txId: string
) {
  const addresses = await getContractAddresses(operatorSigner, l1Network);
  const utxos = await l1Provider.listUtxos(
    addresses[address],
    DEFAULT_FROM_BLOCK,
    DEFAULT_TO_BLOCK
  );
  const utxo = utxos.find((utxo: Utxo) => utxo.txId === txId);

  if (!utxo) {
    console.log('utxos', utxos);
    throw new Error(`${address} utxo of: ${txId} not found`);
  }

  return utxo;
}

/// finalize a deposit batch on l1
export async function finalizeDepositBatchOnL1(
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,
  l1Provider: L1Provider,
  feeRate: number,
  rootState: DepositAggregationState,
  bridgeState: BridgeCovenantState
): Promise<[BridgeCovenantState, string]> {
  const operatorPubKey = await operatorSigner.getPublicKey();
  const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

  const bridgeUtxo = await findUtxo(
    operatorSigner,
    l1Network,
    l1Provider,
    'bridge',
    bridgeState.latestTx.hash
  );

  const emptyBatchIDIndex = bridgeState.merkleTree.findIndex(
    (batch) => batch === BridgeCovenant.EMPTY_BATCH_ID
  );
  if (emptyBatchIDIndex === -1) {
    throw new Error(
      'the bridge state batchId is full, please finalizeL2 to clear one batchId'
    );
  }

  const lastLevelRawtx = await chainProvider.getRawTransaction(
    rootState.tx.hash
  );
  const lastLevelUtxo = utils.txToUtxo(lastLevelRawtx, 1);

  const traceableBridgeUtxo: TraceableBridgeUtxo = {
    operator: PubKey(operatorPubKey),
    expanderSPK: spks.withdrawExpander,
    state: bridgeState,
    utxo: bridgeUtxo,
  };

  const traceableDepositAggregatorUtxo: TraceableDepositAggregatorUtxo = {
    operator: PubKey(operatorPubKey),
    bridgeSPK: spks.bridge,
    state: rootState,
    utxo: lastLevelUtxo,
  };

  const res = await bridgeFeatures.finalizeL1Deposit(
    operatorSigner,
    l1Network,
    utxoProvider,
    chainProvider,
    traceableBridgeUtxo,
    traceableDepositAggregatorUtxo,
    feeRate
  );

  return [
    {
      ...res.state,
      latestTx: {
        type: 'l1tx',
        status: 'UNCONFIRMED',
        hash: res.txid,
      },
    },
    res.finalizedBatchId,
  ];
}

/// verify the deposit batch on l1
export async function verifyDepositBatch(
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,
  l1Provider: L1Provider,
  feeRate: number,
  bridgeState: BridgeCovenantState,
  batchId: BatchId
): Promise<BridgeCovenantState> {
  const operatorPubKey = await operatorSigner.getPublicKey();
  const spks = getContractScriptPubKeys(PubKey(operatorPubKey));
  const addresses = await getContractAddresses(operatorSigner, l1Network);

  const bridgeUtxos = await l1Provider.listUtxos(
    addresses.bridge,
    DEFAULT_FROM_BLOCK,
    DEFAULT_TO_BLOCK
  );
  const bridgeUtxo = bridgeUtxos.find(
    (utxo: Utxo) => utxo.txId === bridgeState.latestTx.hash
  );

  if (!bridgeUtxo) {
    throw new Error('bridge utxo not found');
  }

  const emptyBatchIDIndex = bridgeState.merkleTree.findIndex(
    (batch) => batch === BridgeCovenant.EMPTY_BATCH_ID
  );
  if (emptyBatchIDIndex === -1) {
    throw new Error(
      'the bridge state batchId is full, please finalizeL2 to clear one batchId'
    );
  }

  const batchIDIndex = bridgeState.merkleTree.findIndex(
    (batch) => batch === batchId
  );
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
    Sha256(batchId), // extra hash here seems strange...
    bridgeTraceableUtxo,
    feeRate
  );

  return {
    ...res.state,
    latestTx: {
      type: 'l1tx',
      status: 'UNCONFIRMED',
      hash: res.txid,
    },
  };
}

/// get the status of a l1 transaction
export function getL1TransactionStatus(
  l1Provider: L1Provider,
  txid: L1TxHash
): Promise<L1TxStatus> {
  // console.log(`getL1TransactionStatus(${txid})`)
  return l1Provider.getTransactionStatus(txid);
}

/// get the current block number of l1
export function getL1CurrentBlockNumber(
  l1Provider: L1Provider
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

// export async function createWithdrawal(
//   operatorSigner: Signer,
//   l1Network: SupportedNetwork,
//   utxoProvider: UtxoProvider,
//   chainProvider: ChainProvider,
//   l1Provider: L1Provider,
//   offchainDataProvider: OffchainDataProvider,
//   feeRate: number,
//   batch: WithdrawalBatch
// ): Promise<L1TxHash> {
//   // 1. verify the batch is valid
//   if ((batch as WithdrawalBatch & { status: 'EXPANDED' }).withdrawBatchTx) {
//     throw new Error('expander is already created, should not create again');
//   }
//   if (batch.withdrawals.length === 0) {
//     throw new Error('batch must have at least 1 withdrawal');
//   }

//   // 2. build tx
//   const [bridgeUtxo, bridgeState] = await checkBridgeUtxo(
//     offchainDataProvider,
//     l1Provider,
//     operatorSigner,
//     l1Network
//   );
//   const operatorPubKey = await operatorSigner.getPublicKey();
//   const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

//   const res = await bridgeFeatures.createWithdrawalExpander(
//     operatorSigner,
//     l1Network,
//     utxoProvider,
//     chainProvider,

//     {
//       operator: PubKey(operatorPubKey),
//       expanderSPK: spks.withdrawExpander,
//       state: bridgeState,
//       utxo: bridgeUtxo,
//     },
//     batch.withdrawals.map((withdrawal) => ({
//       l1Address: withdrawal.recipient,
//       amt: withdrawal.amount,
//     })),
//     feeRate
//   );
//   await offchainDataProvider.setLatestBridgeTxid(res.txid as L1TxHash);
//   await offchainDataProvider.setBridgeState(
//     res.txid as L1TxHash,
//     res.bridgeState.batchesRoot,
//     res.bridgeState.merkleTree,
//     res.bridgeState.depositAggregatorSPK
//   );
//   // console.log(`createWithdrawal(batch) done, txid: ${res.txid}`)
//   return res.txid as L1TxHash;
// }

export async function createWithdrawal2(
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  utxoProvider: UtxoProvider,
  chainProvider: ChainProvider,
  l1Provider: L1Provider,
  feeRate: number,
  bridgeState: BridgeCovenantState,
  withdrawalMerkleRoot: Sha256,
  outputWithdrawalState: WithdrawalExpanderState
): Promise<BridgeCovenantState> {
  const bridgeUtxo = await findUtxo(
    operatorSigner,
    l1Network,
    l1Provider,
    'bridge',
    bridgeState.latestTx.hash
  );

  const operatorPubKey = await operatorSigner.getPublicKey();
  const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

  const res = await bridgeFeatures.createWithdrawalExpander2(
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
    withdrawalMerkleRoot,
    outputWithdrawalState,
    feeRate
  );

  return {
    ...res.bridgeState,
    latestTx: {
      type: 'l1tx',
      status: 'UNCONFIRMED',
      hash: res.txid,
    },
  };
}

export function shouldExpand(batch: WithdrawalBatch): boolean {
  if (batch.status !== 'BEING_EXPANDED') return false;

  // just distribute for level <= 2
  const height = Math.ceil(Math.log2(batch.withdrawals.length));
  if (height <= WithdrawalExpanderCovenant.MAX_LEVEL_FOR_DISTRIBUTE)
    return false;

  const currentExpandCount = batch.expansionTxs.length;

  // expanding is started, return false
  return (
    height >
    currentExpandCount +
      Number(WithdrawalExpanderCovenant.MAX_LEVEL_FOR_DISTRIBUTE)
  );
}

export function shouldDistribute(batch: WithdrawalBatch): boolean {
  if (batch.status !== 'BEING_EXPANDED') return false;
  return !shouldExpand(batch);
}

// async function parseDataFromWithdrawalBatch(
//   operatorSigner: Signer,
//   batch: WithdrawalBatch,
//   offchainDataProvider: OffchainDataProvider,
//   l1Provider: L1Provider,
//   chainProvider: ChainProvider,
//   l1Network: SupportedNetwork
// ): Promise<{
//   withdrawals: L1Withdrawal[];
//   expanderTxs: Transaction[];
//   expanderUtxos: UTXO[];
//   stateHashes: Sha256[];
//   expanderStates: WithdrawalExpanderState[];
// }> {
//   if (
//     batch.status !== 'BEING_EXPANDED' &&
//     batch.status !== 'EXPANDED'
//   ) {
//     return {
//       withdrawals: [],
//       expanderTxs: [],
//       expanderUtxos: [],
//       stateHashes: [],
//       expanderStates: [],
//     };
//   }
//   const operatorPubKey = await operatorSigner.getPublicKey();
//   const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

//   const expanderL1Txs: L1Tx[] =
//     (batch as WithdrawalBatch & { status: 'EXPANDED' }).expansionTxs?.length > 0
//       ? (batch as WithdrawalBatch & { status: 'EXPANDED' }).expansionTxs.at(-1)!
//       : [(batch as WithdrawalBatch & { status: 'EXPANDED' }).withdrawBatchTx];
//   const expanderTxs = await Promise.all(
//     expanderL1Txs.map((ltx) =>
//       chainProvider.getRawTransaction(ltx.hash).then(Transaction.fromHex)
//     )
//   );
//   const expanderUtxos: UTXO[] = [];
//   const stateHashes: Sha256[] = [];
//   const expanderStates: WithdrawalExpanderState[] = [];
//   const withdrawals = batch.withdrawals.map((withdrawal) => ({
//     l1Address: withdrawal.recipient,
//     amt: withdrawal.amount,
//   }));

//   for (const tx of expanderTxs) {
//     const utxos = utils.getUtxoByScript(tx, spks.withdrawExpander);
//     for (const utxo of utxos) {
//       const hash = Sha256(
//         utils.splitHashFromStateOutput(tx)[
//           utxo.outputIndex ===
//           CONTRACT_INDEXES.outputIndex.withdrawalExpander.inDepositAggregatorTx
//             .first
//             ? 0
//             : 1
//         ] as ByteString
//       );

//       expanderUtxos.push(utxo);
//       stateHashes.push(hash);
//       expanderStates.push(WithdrawalMerkle.getStateForHash(withdrawals, hash));
//     }
//   }

//   const isSameLevel = expanderStates.every(
//     (state) => state.level === expanderStates[0].level
//   );
//   if (!isSameLevel) {
//     throw new Error('something wrong, all the level must be the same');
//   }
//   // verify all the level withdrawalExpanders is not spent
//   {
//     const addresses = await getContractAddresses(operatorSigner, l1Network);
//     const onchainExpanderUtxos = await l1Provider.listUtxos(
//       addresses.withdrawExpander,
//       DEFAULT_FROM_BLOCK,
//       DEFAULT_TO_BLOCK
//     );
//     const onchainUtxoIds = onchainExpanderUtxos.map(
//       (utxo) => `${utxo.txId}:${utxo.outputIndex}`
//     );
//     for (const utxo of expanderUtxos) {
//       const id = `${utxo.txId}:${utxo.outputIndex}`;
//       if (!onchainUtxoIds.includes(id)) {
//         throw new Error(
//           `for expandLevelWithdrawals, the withdrawalExpander(${id}) utxo not found onchain, maybe it is spent`
//         );
//       }
//     }
//   }
//   return {
//     withdrawals,
//     expanderTxs,
//     expanderUtxos,
//     stateHashes,
//     expanderStates,
//   };
// }

// export async function expandLevelWithdrawals(
//   operatorSigner: Signer,
//   l1Network: SupportedNetwork,
//   enhancedUtxoProvider: EnhancedProvider,
//   l1Provider: L1Provider,
//   offchainDataProvider: OffchainDataProvider,

//   feeRate: number,
//   batch: WithdrawalBatch
// ): Promise<L1TxHash[]> {
//   // verify the batch is valid or ready to expand
//   if (
//     batch.status !== 'BEING_EXPANDED'
//   ) {
//     throw new Error(
//       'for expandLevelWithdrawals, batch status must be SUBMITTED_FOR_EXPANSION or BEING_EXPANDED'
//     );
//   }
//   if (!shouldExpand(batch)) {
//     throw new Error('should distribute now');
//   }

//   const operatorPubKey = await operatorSigner.getPublicKey();

//   const { withdrawals, expanderUtxos, expanderStates } =
//     await parseDataFromWithdrawalBatch(
//       operatorSigner,
//       batch,
//       offchainDataProvider,
//       l1Provider,
//       enhancedUtxoProvider,
//       l1Network
//     );

//   for (let i = 0; i < expanderUtxos.length; i++) {
//     const utxo = expanderUtxos[i];
//     const state = expanderStates[i];
//     const traceableUtxo: TraceableWithdrawalExpanderUtxo = {
//       operator: PubKey(operatorPubKey),
//       state: state,
//       utxo: utxo,
//     };
//     const res = await withdrawFeatures.expandWithdrawal(
//       operatorSigner,
//       l1Network,
//       enhancedUtxoProvider,
//       enhancedUtxoProvider,

//       traceableUtxo,
//       withdrawals,

//       feeRate
//     );
//   }
//   const broadcastRes = await enhancedUtxoProvider.finalBroadcast();
//   if (
//     broadcastRes.failedBroadcastTxError &&
//     broadcastRes.broadcastedTxids.length === 0
//   ) {
//     throw broadcastRes.failedBroadcastTxError;
//   }
//   return broadcastRes.broadcastedTxids as L1TxHash[];
// }

export async function expandLevelWithdrawals2(
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  enhancedUtxoProvider: EnhancedProvider,
  feeRate: number,
  level: number,
  withdrawalsTree: ExpansionMerkleTree,
  expansionLevelTxs: L1Tx[]
): Promise<L1Tx[]> {
  const expanderTxs: Transaction[] = (
    await Promise.all(
      expansionLevelTxs.map((tx) =>
        enhancedUtxoProvider.getRawTransaction(tx.hash)
      )
    )
  ).map(Transaction.fromHex);

  const operatorPubKey = await operatorSigner.getPublicKey();
  const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

  const expanderUtxos = expanderTxs
    .map((tx) => utils.getUtxoByScript(tx, spks.withdrawExpander))
    .flat();

  for (let i = 0; i < expanderUtxos.length; i++) {
    const traceableUtxo: TraceableWithdrawalExpanderUtxo = {
      operator: PubKey(operatorPubKey),
      state: WithdrawalMerkle.getStateForHashFromTree(
        withdrawalsTree,
        withdrawalsTree.levels[level][i].hash
      ),
      utxo: expanderUtxos[i],
    };

    if (traceableUtxo.state.type === 'LEAF') {
      throw new Error('expander utxo is a leaf');
    }

    if (
      traceableUtxo.state.leftAmt === 0n &&
      traceableUtxo.state.rightAmt === 0n
    )
      continue;

    const leftState = WithdrawalMerkle.getStateForHashFromTree(
      withdrawalsTree,
      withdrawalsTree.levels[level + 1][2 * i].hash
    );

    const rightState = WithdrawalMerkle.getStateForHashFromTree(
      withdrawalsTree,
      withdrawalsTree.levels[level + 1][2 * i + 1].hash
    );

    const res = await withdrawFeatures.expandWithdrawal2(
      operatorSigner,
      l1Network,
      enhancedUtxoProvider,
      enhancedUtxoProvider,
      traceableUtxo,
      leftState,
      rightState,
      feeRate
    );
  }
  const broadcastRes = await enhancedUtxoProvider.finalBroadcast();
  if (
    broadcastRes.failedBroadcastTxError &&
    broadcastRes.broadcastedTxids.length === 0
  ) {
    throw broadcastRes.failedBroadcastTxError;
  }

  return broadcastRes.broadcastedTxids.map((hash) => ({
    type: 'l1tx',
    hash: hash,
    status: 'UNCONFIRMED',
  }));
}

// export async function distributeLevelWithdrawals(
//   operatorSigner: Signer,
//   l1Network: SupportedNetwork,
//   enhancedUtxoProvider: EnhancedProvider,
//   l1Provider: L1Provider,
//   offchainDataProvider: OffchainDataProvider,

//   feeRate: number,
//   batch: WithdrawalBatch
// ) {
//   // verify the batch is valid or ready to distribute
//   if (!shouldDistribute(batch)) {
//     throw new Error('should expand now');
//   }

//   const operatorPubKey = await operatorSigner.getPublicKey();

//   // build the txs
//   const { withdrawals, expanderUtxos, expanderStates } =
//     await parseDataFromWithdrawalBatch(
//       operatorSigner,
//       batch,
//       offchainDataProvider,
//       l1Provider,
//       enhancedUtxoProvider,
//       l1Network
//     );

//   for (let i = 0; i < expanderUtxos.length; i++) {
//     const utxo = expanderUtxos[i];
//     const state = expanderStates[i];
//     const traceableUtxo: TraceableWithdrawalExpanderUtxo = {
//       operator: PubKey(operatorPubKey),
//       state: state,
//       utxo: utxo,
//     };
//     await withdrawFeatures.distributeWithdrawals(
//       operatorSigner,
//       l1Network,
//       enhancedUtxoProvider,
//       enhancedUtxoProvider,

//       traceableUtxo,
//       withdrawals,

//       feeRate
//     );
//   }
//   const broadcastRes = await enhancedUtxoProvider.finalBroadcast();
//   if (
//     broadcastRes.failedBroadcastTxError &&
//     broadcastRes.broadcastedTxids.length === 0
//   ) {
//     throw broadcastRes.failedBroadcastTxError;
//   }
//   return broadcastRes.broadcastedTxids as L1TxHash[];
// }

export async function distributeLevelWithdrawals2(
  operatorSigner: Signer,
  l1Network: SupportedNetwork,
  enhancedUtxoProvider: EnhancedProvider,
  feeRate: number,
  level: number,
  withdrawalsTree: ExpansionMerkleTree,
  expansionLevelTxs: L1TxStatus[]
): Promise<L1Tx[]> {
  const expanderTxs = await Promise.all(
    expansionLevelTxs.map((tx) =>
      enhancedUtxoProvider.getRawTransaction(tx.hash).then(Transaction.fromHex)
    )
  );

  const operatorPubKey = await operatorSigner.getPublicKey();
  const spks = getContractScriptPubKeys(PubKey(operatorPubKey));

  const expanderUtxos = expanderTxs
    .map((tx) => utils.getUtxoByScript(tx, spks.withdrawExpander))
    .flat();

  for (let i = 0; i < expanderUtxos.length; i++) {
    const node = withdrawalsTree.levels[level][i];
    const traceableUtxo: TraceableWithdrawalExpanderUtxo = {
      operator: PubKey(operatorPubKey),
      state: WithdrawalMerkle.getStateForHashFromTree(
        withdrawalsTree,
        node.hash
      ),
      utxo: expanderUtxos[i],
    };

    await withdrawFeatures.distributeWithdrawals2(
      operatorSigner,
      l1Network,
      enhancedUtxoProvider,
      enhancedUtxoProvider,

      traceableUtxo,
      WithdrawalMerkle.getNodeForHashFromTree(withdrawalsTree, node.hash)
        .withdrawals,
      feeRate
    );
  }
  const broadcastRes = await enhancedUtxoProvider.finalBroadcast();
  if (
    broadcastRes.failedBroadcastTxError &&
    broadcastRes.broadcastedTxids.length === 0
  ) {
    throw broadcastRes.failedBroadcastTxError;
  }
  return broadcastRes.broadcastedTxids.map((hash) => ({
    type: 'l1tx',
    hash: hash,
    status: 'UNCONFIRMED',
  }));
}

export async function getBridgeBalance(
  operatorSigner: Signer,
  latestBridgeTxid: L1TxHash,
  utxoProvider: UtxoProvider,
  l1Network: SupportedNetwork
): Promise<bigint> {
  const addresses = await getContractAddresses(operatorSigner, l1Network);
  const utxos = await utxoProvider.getUtxos(addresses.bridge);
  const bridgeUtxo = utxos.find((utxo) => utxo.txId === latestBridgeTxid);
  if (!bridgeUtxo) {
    throw new Error('bridge utxo not found');
  }
  return BigInt(bridgeUtxo.satoshis);
}
