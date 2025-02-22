import { Psbt } from '@scrypt-inc/bitcoinjs-lib'

const getResponse = async (l1Address: string, l2Address: string, depositAmount: string) => {
    const res = await fetch('/api/deposit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            l1Address: l1Address,
            l2Address: l2Address,
            depositAmount: depositAmount
        })
    })
    const data = await res.json()
    console.log('response', data)
    return data;
}

const signPsbt = async (psbt: string, psbtOptions: any) => {
    const unisat = (window as any)['unisat'];
    const signedPsbt = await unisat.signPsbt(psbt, psbtOptions);
    return signedPsbt;
}

const broadcastTx = async (psbt: string) => {
    const unisat = (window as any)['unisat'];
    const txid = await unisat.pushPsbt(psbt);
    return txid;
}


document.getElementById('depositButton')!.addEventListener('click', async () => {
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

    // Connect the current unisat account.
    // https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet#requestaccounts
    await unisat.requestAccounts();
    // switch unisat to the correct network
    // https://docs.unisat.io/dev/unisat-developer-center/unisat-wallet#switchchain
    await unisat.switchChain('FRACTAL_BITCOIN_TESTNET')

    // get the current unisat account address
    const l1Address = (await unisat.getAccounts())[0];

    // get the l2 address from the input
    const l2Address = (document.getElementById('l2Address') as HTMLInputElement).value;
    // get the deposit amount from the input
    const depositAmount = (document.getElementById('depositAmount') as HTMLInputElement).value;

    // convert the deposit amount to satoshis
    const amount = Math.round(Number(depositAmount) * 1e8);
    if (amount > 21 * 1e8) {
        alert('deposit amount must be less than 21 btc');
        return;
    }
    if (amount <= 0) {
        alert('deposit amount must be greater than 0');
        return;
    }

    // get the psbt(transaction) from the backend
    const response = await getResponse(l1Address, l2Address, amount.toString());
    const { psbtOptions, deposit, psbt } = response;

    // sign the psbt with unisat
    const signedPsbt = Psbt.fromHex(await signPsbt(psbt, psbtOptions));
    signedPsbt.finalizeAllInputs();
    
    // broadcast the transaction
    const txid = await broadcastTx(signedPsbt.toHex());
    console.log('txid', txid);
    console.log('deposit', deposit);
    (document.getElementById('result') as HTMLDivElement).innerHTML = `
        <p>deposit success</p>
        deposit txid: <a href="https://mempool-testnet.fractalbitcoin.io/tx/${deposit.origin.hash}" target="_blank">${deposit.origin.hash}</a>
    `
    alert('deposit success')
})