import { PubKey } from 'scrypt-ts'
import { BridgeCovenant } from './bridgeCovenant'
import { DepositAggregatorCovenant } from './depositAggregatorCovenant'
import { WithdrawalExpanderCovenant } from './withdrawalExpanderCovenant'

export function getScriptPubKeys(operatorPubKey: PubKey) {
  const withdrawExpander = new WithdrawalExpanderCovenant(
    operatorPubKey,
    WithdrawalExpanderCovenant.createEmptyState()
  )
  const bridge = new BridgeCovenant(
    operatorPubKey,
    withdrawExpander.lockingScriptHex,
    BridgeCovenant.createEmptyState('')
  )
  const depositAggregator = new DepositAggregatorCovenant(
    operatorPubKey,
    bridge.lockingScriptHex,
    DepositAggregatorCovenant.createEmptyState()
  )
  return {
    withdrawExpander: withdrawExpander.lockingScriptHex,
    bridge: bridge.lockingScriptHex,
    depositAggregator: depositAggregator.lockingScriptHex,
  }
}
