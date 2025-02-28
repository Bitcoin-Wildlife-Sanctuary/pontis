// We can disregard this rule since it's type-only export
// eslint-disable-next-line no-restricted-syntax
export type * from '../../../operator/src/state';

import {DepositBatch, L1TxStatus, L2TxStatus, WithdrawalBatch} from '../../../operator/src/state';

export type TxStatus = L1TxStatus['status'] | L2TxStatus['status'];

export type DepositStatus = DepositBatch['status'];

export type WithdrawalStatus = WithdrawalBatch['status'];
