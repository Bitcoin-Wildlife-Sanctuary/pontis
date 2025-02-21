import { L2Address } from "../../state";
import { getContractScriptPubKeys, Signer, SupportedNetwork, utils } from "l1";
import { PubKey } from "scrypt-ts"; 

export async function getContractAddresses(
    operatorSigner: Signer,
    l1Network: SupportedNetwork
): Promise<{
    bridge: string;
    depositAggregator: string;
    withdrawExpander: string;
    operator: string;
}> {
    const operatorPubKey = await operatorSigner.getPublicKey();
    const spks = getContractScriptPubKeys(PubKey(operatorPubKey));
    const addressess =  {
        bridge: utils.p2trLockingScriptToAddr(spks.bridge, l1Network),
        depositAggregator: utils.p2trLockingScriptToAddr(spks.depositAggregator, l1Network),
        withdrawExpander: utils.p2trLockingScriptToAddr(spks.withdrawExpander, l1Network),
        operator: await operatorSigner.getAddress(),
    }
    return addressess;
}

export function l2AddressToHex(l2Address: L2Address): string {
    let hex: string = l2Address;
    if (l2Address.startsWith('0x')) {
        hex = hex.slice(2);
    }
    hex = hex.padStart(64, '0');
    return hex;
}
