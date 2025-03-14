import { L2Address } from '../../state';
import {
  Bridge,
  DepositAggregator,
  getContractScriptPubKeys,
  Signer,
  SupportedNetwork,
  utils,
  WithdrawalExpander,
} from 'l1';
import { PubKey } from 'scrypt-ts';
import { address as addressUtils } from '@scrypt-inc/bitcoinjs-lib';
import { toHex } from 'uint8array-tools';

import depositAggregatorArtifact from 'l1/artifacts/contracts/depositAggregator.json';
import bridgeArtifact from 'l1/artifacts/contracts/bridge.json';
import withdrawExpanderArtifact from 'l1/artifacts/contracts/withdrawalExpander.json';

export async function getContractAddresses(
  operatorSigner: Signer,
  l1Network: SupportedNetwork
) {
  const operatorPubKey = await operatorSigner.getPublicKey();
  const spks = getContractScriptPubKeys(PubKey(operatorPubKey));
  const addressess = {
    bridge: utils.p2trLockingScriptToAddr(spks.bridge, l1Network),
    depositAggregator: utils.p2trLockingScriptToAddr(
      spks.depositAggregator,
      l1Network
    ),
    withdrawExpander: utils.p2trLockingScriptToAddr(
      spks.withdrawExpander,
      l1Network
    ),
    operator: await operatorSigner.getAddress(),
  };
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

/// loadContractArtifacts from l1 package cannot be used in browser, but this function can be used in browser
export async function loadContractArtifacts() {
  DepositAggregator.loadArtifact(depositAggregatorArtifact);
  Bridge.loadArtifact(bridgeArtifact);
  WithdrawalExpander.loadArtifact(withdrawExpanderArtifact);
}

export function addressToScript(btcAddress: string, network: SupportedNetwork) {
  return toHex(
    addressUtils.toOutputScript(
      btcAddress,
      utils.supportedNetworkToBtcNetwork(network)
    )
  );
}
