import {loadContractArtifacts, getContractScriptPubKeys, btcRpc, utils, BridgeCovenant, bridgeFeatures} from 'l1'
import * as env from './env'
import { PubKey } from 'scrypt-ts'
import { createDbFile, getOffChainDB } from './utils/offchain'
import { listUtxos } from './utils/chain'
import { L1TxHash } from '../state'
import { getContractAddresses } from './utils/contractUtil';
export async function createBridgeContract() {
    const operatorPubKey = await env.operatorSigner.getPublicKey()
    const addresses = await getContractAddresses();
    
    let shouldCreateBridge = false;
    const offchainDB = getOffChainDB();
    const bridgeTxid = await offchainDB.getLatestBridgeTxid();
    if (bridgeTxid) {
        const utxos = await listUtxos(addresses.bridge);
        const findUtxo = utxos.find(utxo => utxo.txId === bridgeTxid);
        shouldCreateBridge = findUtxo ? false : true;
    } else {
        shouldCreateBridge = true;
    }

    if (!shouldCreateBridge) {
        return;
    }

    const { txid, state } = await bridgeFeatures.deployBridge(
        PubKey(operatorPubKey),
        env.operatorSigner,
        env.l1Network,
        env.createUtxoProvider(),
        env.createChainProvider(),
        env.l1FeeRate
    )
    console.log('prev bridge txid', bridgeTxid)
    console.log('deployBridge txid', txid)
    await offchainDB.setLatestBridgeTxid(txid as L1TxHash);
    await offchainDB.setBridgeState(txid as L1TxHash, state.batchesRoot, state.merkleTree, state.depositAggregatorSPK);
}

export async function importAddressesIntoNode() {
    const operatorPubKey = await env.operatorSigner.getPublicKey()

    const addresses = await getContractAddresses();

    console.log('l1 addresses:')
    console.log('bridgeAddr', addresses.bridge)
    console.log('depositAggregatorAddr', addresses.depositAggregator)
    console.log('withdrawExpanderAddr', addresses.withdrawExpander)
    console.log('operatorAddr', addresses.operator)

    
    if (!env.useRpc) {
        return;
    }

    console.log('importing addresses into node', addresses.bridge)
    await btcRpc.rpc_importaddress(
        env.rpcConfig.host,
        env.rpcConfig.user,
        env.rpcConfig.password,
        env.rpcConfig.wallet, 
        addresses.bridge
    )

    console.log('importing addresses into node', addresses.depositAggregator)
    await btcRpc.rpc_importaddress(
        env.rpcConfig.host,
        env.rpcConfig.user,
        env.rpcConfig.password,
        env.rpcConfig.wallet, 
        addresses.depositAggregator
    )

    console.log('importing addresses into node', addresses.withdrawExpander)
    await btcRpc.rpc_importaddress(
        env.rpcConfig.host,
        env.rpcConfig.user,
        env.rpcConfig.password,
        env.rpcConfig.wallet, 
        addresses.withdrawExpander
    );

    console.log('importing addresses into node', addresses.operator)
    await btcRpc.rpc_importaddress(
        env.rpcConfig.host,
        env.rpcConfig.user,
        env.rpcConfig.password,
        env.rpcConfig.wallet, 
        addresses.operator
    )
}

export async function prepareL1() {
    // 1. load l1 contract artifacts
    loadContractArtifacts()
    
    // 2. add contract spks and operator signer to node if using rpc providers
    await importAddressesIntoNode()

    // 3. create l1 offchain db if not exists
    createDbFile()

    // 4. create bridge contract instance if not exists
    await createBridgeContract()
}