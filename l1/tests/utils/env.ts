import dotenv from 'dotenv'
import { SupportedNetwork } from '../../src/lib/constants';
dotenv.config();

// require private key if REMOTE_NETWORK is set
if (process.env.REMOTE_NETWORK) {
  if (!process.env.PRIVATE_KEY) {
    throw new Error('env.PRIVATE_KEY is not set');
  }
}

export const PRIVATE_KEY = process.env.PRIVATE_KEY;
export const IS_LOCAL = process.env.REMOTE_NETWORK === undefined;
export const REMOTE_NETWORK = process.env.REMOTE_NETWORK as SupportedNetwork;
