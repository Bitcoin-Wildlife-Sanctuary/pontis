import {loadContractArtifacts, btcRpc, BridgeState} from 'l1'
import * as env from './env'
import { getFileOffChainDataProvider } from './deps/offchainDataProvider'
import { createL1Provider } from './deps/l1Provider'
import { getContractAddresses } from './utils/contractUtil';
import * as api from './api';
import { BridgeCovenantState } from '../state';
export async function importAddressesIntoNode() {
    const addresses = await getContractAddresses(env.operatorSigner, env.l1Network);

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

export async function prepareL1(): Promise<BridgeCovenantState> {
    // 1. load l1 contract artifacts
    loadContractArtifacts()
    
    // 2. add contract spks and operator signer to node if using rpc providers
    await importAddressesIntoNode()

    const offchainDataProvider = getFileOffChainDataProvider()

    // 4. create bridge contract instance if not exists
    await api.createBridgeContractIfNotExists(
        env.operatorSigner,
        env.l1Network,
        env.createUtxoProvider(),
        env.createChainProvider(),
        offchainDataProvider,
        createL1Provider(env.useRpc, env.rpcConfig, env.l1Network),
        env.l1FeeRate
    )

    const latestBridgeTxid = await offchainDataProvider.getLatestBridgeTxid();
    const bridgeState = await offchainDataProvider.getBridgeState(latestBridgeTxid!) as BridgeState;
    
    return {
        ...bridgeState,
        latestTx: {
            type: 'l1tx',
            hash: latestBridgeTxid!,
            status: 'UNCONFIRMED' // tx status will be fetched by the operator
        }
    }
}