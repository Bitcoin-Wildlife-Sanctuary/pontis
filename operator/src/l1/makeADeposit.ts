import { L2Address } from '../state';
import * as l1Api from './api';
import * as env from './env';
import { PubKey } from 'scrypt-ts';
import { loadContractArtifacts } from './utils/contractUtil';

const main = async () => {
  loadContractArtifacts();

  const l2Address: L2Address = // alice
    '0x078662e7352d062084b0010068b99288486c2d8b914f6e2a55ce945f8792c8b1';

  const depositAmt = 509n;
  const operatorPubKey = await env.operatorSigner.getPublicKey();
  const deposit = await l1Api.createDeposit(
    PubKey(operatorPubKey),
    env.l1Network,
    env.createUtxoProvider(),
    env.createChainProvider(),

    env.l1FeeRate,

    env.operatorSigner,
    l2Address,
    depositAmt
  );
  console.log('deposit', deposit);
};

main().catch(console.error);
