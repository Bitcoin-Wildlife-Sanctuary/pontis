// We can disregard this rule since it's type-only export
// eslint-disable-next-line no-restricted-syntax
export type * from 'operator';

import {DepositBatch, L1Tx, L1TxStatus, L2TxStatus, OperatorState, WithdrawalBatch} from 'operator';

export type TxStatus = L1TxStatus['status'] | L2TxStatus['status'];

export type DepositStatus = DepositBatch['status'];

export type WithdrawalStatus = WithdrawalBatch['status'];

export type StatusType = 'error' | 'pending' | 'success';

export type StateWithDate = {
  state: OperatorState;
  lastUpdate: Date;
};

export type WithdrawalExpansionNode = (WithdrawalBatch & {status: 'EXPANDED'})['expansionTree'];
export type WithdrawalExpansionInnerNode = WithdrawalExpansionNode & {type: 'INNER'};
export type WithdrawalExpansionLeafNode = WithdrawalExpansionNode & {type: 'LEAF'};

export type AccumulatedExpansionTx =
  | (L1Tx & {
      nodeType: WithdrawalExpansionNode['type'];
      nodeHash: WithdrawalExpansionNode['hash'];
      total?: WithdrawalExpansionLeafNode['total'];
      address?: WithdrawalExpansionLeafNode['l1Address'];
    })
  | null;
