import { PubKey } from 'scrypt-ts'
import { BridgeCovenant } from './bridgeCovenant'
import { DepositAggregatorCovenant } from './depositAggregatorCovenant'
import { WithdrawalExpanderCovenant } from './withdrawalExpanderCovenant'
import { checkDisableOpCodeHex, outputToByteString } from '../lib/txTools'
import { Transaction } from '@scrypt-inc/bitcoinjs-lib'
import * as tools from 'uint8array-tools'

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

export function getChangeOutput(tx: Transaction, excludeContractScripts: string[]) {
  // in our transaction, the output is the last one
  const lastOutput = tx.outs[tx.outs.length - 1];
  if (excludeContractScripts.includes(tools.toHex(lastOutput.script))) {
    return ''
  }
  return outputToByteString(tx, tx.outs.length - 1)
}

export const CONTRACT_INDEXES = {
  outputIndex: {
    state: 0,
    bridge: 1,
    withdrawalExpander: {
      inBridgeTx: 2,
      inDepositAggregatorTx: {
        first: 1,
        second: 2,
      }
    },
    depositAggregator: 1,
  },
  inputIndex: {
    bridge: 0,
    depositAggregator: {
      inAggregateDepositTx: {
        first: 0,
        second: 1,
      },
      inFinalizeL1Tx: 1
    },
    withdrawalExpander: 0
  }
}
