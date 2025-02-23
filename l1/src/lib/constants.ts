// the pubkey defined in taproot bip, has no private key
export const TAPROOT_ONLY_SCRIPT_SPENT_KEY =
  '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0'

export enum Postage {
  DEPOSIT_AGGREGATOR_POSTAGE = 332,
  WITHDRAWAL_EXPANDER_POSTAGE = 331,
  BRIDGE_POSTAGE = 330,
}

export type SupportedNetwork =
  | 'btc-signet'
  | 'fractal-mainnet'
  | 'fractal-testnet'
