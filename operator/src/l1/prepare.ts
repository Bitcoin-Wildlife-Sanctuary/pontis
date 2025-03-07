import { btcRpc, BridgeState } from 'l1';
import { getFileOffChainDataProvider } from './deps/offchainDataProvider';
import { createL1Provider } from './deps/l1Provider';
import { getContractAddresses } from './utils/contractUtil';
import * as api from './api';
import { BridgeCovenantState } from '../state';
import { loadContractArtifacts } from './utils/contractUtil';
import logger from '../logger';
import { Config } from '../config';

export async function importAddressesIntoNode(config: Config) {
  const addresses = await getContractAddresses(
    config.l1.operatorSigner,
    config.l1.network
  );

  logger.info(addresses, 'l1 addresses:');

  if (!config.l1.useRpc) {
    return;
  }

  await btcRpc.rpc_importaddress(
    config.l1.rpcConfig.host!,
    config.l1.rpcConfig.user!,
    config.l1.rpcConfig.password!,
    config.l1.rpcConfig.wallet!,
    addresses.bridge
  );

  await btcRpc.rpc_importaddress(
    config.l1.rpcConfig.host!,
    config.l1.rpcConfig.user!,
    config.l1.rpcConfig.password!,
    config.l1.rpcConfig.wallet!,
    addresses.depositAggregator
  );

  await btcRpc.rpc_importaddress(
    config.l1.rpcConfig.host!,
    config.l1.rpcConfig.user!,
    config.l1.rpcConfig.password!,
    config.l1.rpcConfig.wallet!,
    addresses.withdrawExpander
  );

  await btcRpc.rpc_importaddress(
    config.l1.rpcConfig.host!,
    config.l1.rpcConfig.user!,
    config.l1.rpcConfig.password!,
    config.l1.rpcConfig.wallet!,
    addresses.operator
  );
}

export async function prepareL1(config: Config): Promise<BridgeCovenantState> {
  // 1. load l1 contract artifacts
  loadContractArtifacts();

  // 2. add contract spks and operator signer to node if using rpc providers
  await importAddressesIntoNode(config);

  const offchainDataProvider = getFileOffChainDataProvider();

  // 4. create bridge contract instance if not exists
  await api.createBridgeContractIfNotExists(
    config.l1.operatorSigner,
    config.l1.network,
    config.l1.createUtxoProvider(),
    config.l1.createChainProvider(),
    offchainDataProvider,
    createL1Provider(
      config.l1.useRpc,
      config.l1.rpcConfig as any,
      config.l1.network
    ),
    config.l1.feeRate
  );

  const latestBridgeTxid = await offchainDataProvider.getLatestBridgeTxid();
  const bridgeState = (await offchainDataProvider.getBridgeState(
    latestBridgeTxid!
  )) as BridgeState;

  return {
    ...bridgeState,
    latestTx: {
      type: 'l1tx',
      hash: latestBridgeTxid!,
      status: 'UNCONFIRMED', // tx status will be fetched by the operator
    },
  };
}
