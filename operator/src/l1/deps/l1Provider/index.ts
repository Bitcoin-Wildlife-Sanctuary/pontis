import { MempoolL1Provider } from './mempoolL1Provider';
import { RPCL1Provider } from './rpcL1Provider';
import { L1Provider } from './type';
import { SupportedNetwork } from 'l1';

export * from './type';
export * from './mempoolL1Provider';
export * from './rpcL1Provider';
export * from './mockL1Provider';

export function createL1Provider(
  useRpc: boolean,
  rpcConfig: {
    host: string;
    user: string;
    password: string;
    wallet: string;
  },
  l1Network: SupportedNetwork
): L1Provider {
  if (useRpc) {
    return new RPCL1Provider(
      rpcConfig.host,
      rpcConfig.user,
      rpcConfig.password,
      rpcConfig.wallet
    );
  }
  return new MempoolL1Provider(l1Network);
}
