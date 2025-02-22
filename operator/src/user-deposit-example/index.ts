

import { PubKey } from 'scrypt-ts';
import * as api from '../l1/api'
import {MempoolChainProvider, MempoolUtxoProvider, UnisatSigner} from 'l1'
import { L2Address } from '../state';
import { loadContractArtifacts } from '../l1/utils/contractUtil';


const depositButton = document.getElementById('depositButton')!;

depositButton.addEventListener('click', async () => {
    loadContractArtifacts()

    // get the l2 address from the input
    const l2Address = (document.getElementById('l2Address') as HTMLInputElement).value;
    // get the deposit amount from the input
    const depositAmount = (document.getElementById('depositAmount') as HTMLInputElement).value;

    // `unisat` global object is injected by the unisat extension
    // it need time to be ready, if you use it at the beginning, it will be undefined, you need to wait or detect it's ready.
    // refs: https://github.com/unisat-wallet/unisat-web3-demo/blob/master/src/App.tsx#L136-L138
    
    // unisat is injected by the unisat extension
    // https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet#browser-detection
    const unisat = (window as any)['unisat'];
    if (!unisat) {
        alert('unisat is not installed, you need to install it first');
        return;
    }

    // here we do not read from the env, because we are not in the browser
    // the config can be injected by backend or just do a request to the backend to get the config
    const l1Network = 'fractal-testnet';

    // the operator public key is calculated from L1_OPERATOR_PRIVATE_KEY environment variable
    // await new DefaultSigner(ECPair.fromWIF(operatorPrivateKey), l1Network).getPublicKey()
    const operatorPubKey = '03bfac5406925f9fa00194aa5fd093f60775d90475dcf88c24359eddd385b398a8';
    // fee rate is set by use, can be the same with  L1_FEE_RATE environment variable
    const l1FeeRate = 1.2;

    // for browser, we use mempool provider instead of rpc provider, because the rpc provider required rpc password, which should not be exposed to the browser
    const utxoProvider = new MempoolUtxoProvider(l1Network);
    const chainProvider = new MempoolChainProvider(l1Network);

    // Connect the current unisat account.
    // https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet#requestaccounts
    await unisat.requestAccounts();
    // switch unisat to the correct network
    // https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet#switchchain
    await unisat.switchChain('FRACTAL_BITCOIN_TESTNET')

    // this is our signer interface
    const userSigner = new UnisatSigner(unisat);
    const userAddress = await userSigner.getAddress();

    console.log('userAddress', userAddress);

    // convert the deposit amount to satoshis
    const amount = Math.round(Number(depositAmount) * 1e8);
    if (amount > 21*1e8) {
        alert('deposit amount must be less than 21 btc');
        return;
    }
    if (amount <= 0) {
        alert('deposit amount must be greater than 0');
        return;
    }

    console.log('start deposit...', {l2Address, depositAmount})

    // construct deposit transaction and broadcast it
    const result = await api.createDeposit(
        PubKey(operatorPubKey),
        l1Network,
        utxoProvider,
        chainProvider,

        l1FeeRate,
        userSigner,
        l2Address as L2Address,
        BigInt(amount),
    )
    console.log('deposit', result);
    (document.getElementById('result') as HTMLDivElement).innerHTML = `
        <p>deposit success</p>
        deposit txid: <a href="https://mempool-testnet.fractalbitcoin.io/tx/${result.origin.hash}" target="_blank">${result.origin.hash}</a>
    `
    alert('deposit success')
})
