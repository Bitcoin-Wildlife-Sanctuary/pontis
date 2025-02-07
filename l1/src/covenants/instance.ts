import { PubKey } from 'scrypt-ts'
import { BridgeCovenant } from './bridgeCovenant'
import { DepositAggregatorCovenant } from './depositAggregatorCovenant'
import { WithdrawalExpanderCovenant } from './withdrawalExpanderCovenant'
import { checkDisableOpCodeHex } from '../lib/txTools'

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

  if (checkDisableOpCodeHex(bridge.lockingScriptHex)) {
    throw new Error('Bridge covenant has disable opcodes')
  }
  if (checkDisableOpCodeHex(depositAggregator.lockingScriptHex)) {
    throw new Error('Deposit aggregator covenant has disable opcodes')
  }
  if (checkDisableOpCodeHex(withdrawExpander.lockingScriptHex)) {
    throw new Error('Withdraw expander covenant has disable opcodes')
  }

  return {
    withdrawExpander: withdrawExpander.lockingScriptHex,
    bridge: bridge.lockingScriptHex,
    depositAggregator: depositAggregator.lockingScriptHex,
  }
}
