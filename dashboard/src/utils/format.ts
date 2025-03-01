import {DepositStatus, StatusType, TxStatus, WithdrawalStatus} from '@/types';

// eslint-disable-next-line import/no-unused-modules
export const shortenHex = (hex?: string, partLength = 6, separator = '...'): string => {
  if (!hex) return '';

  return `${hex.slice(0, hex.startsWith('0x') ? partLength + 2 : partLength)}${separator}${hex.slice(-partLength)}`;
};

// eslint-disable-next-line import/no-unused-modules
export const showTxStatus = (txStatus?: TxStatus): string => {
  switch (txStatus) {
    case 'DROPPED':
      return 'Dropped';
    case 'ERROR':
      return 'Error';
    case 'MINED':
      return 'Mined';
    case 'PENDING':
      return 'Pending';
    case 'REJECTED':
      return 'Rejected';
    case 'REVERTED':
      return 'Reverted';
    case 'SUCCEEDED':
      return 'Succeeded';
    case 'UNCONFIRMED':
      return 'Unconfirmed';
    default:
      txStatus satisfies undefined;
      return 'Unknown';
  }
};

// eslint-disable-next-line import/no-unused-modules
export const showDepositStatus = (txStatus?: DepositStatus): string => {
  switch (txStatus) {
    case 'BEING_AGGREGATED':
      return 'Being Aggregated';
    case 'AGGREGATED':
      return 'Aggregated';
    case 'FINALIZED':
      return 'Finalized';
    case 'SUBMITTED_TO_L2':
      return 'Submitted to L2';
    case 'DEPOSITED':
      return 'Deposited';
    case 'SUBMITTED_FOR_VERIFICATION':
      return 'Submitted for Verification';
    case 'COMPLETED':
      return 'Completed';
    default:
      txStatus satisfies undefined;
      return 'Unknown';
  }
};

// eslint-disable-next-line import/no-unused-modules
export const showWithdrawalStatus = (txStatus?: WithdrawalStatus): string => {
  switch (txStatus) {
    case 'PENDING':
      return 'Pending';
    case 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED':
      return 'Close Batch Submitted';
    case 'CLOSED':
      return 'Closed';
    case 'SUBMITTED_FOR_EXPANSION':
      return 'Submitted for Expansion';
    case 'BEING_EXPANDED':
      return 'Being Expanded';
    case 'EXPANDED':
      return 'Expanded';
    default:
      txStatus satisfies undefined;
      return 'Unknown';
  }
};

// eslint-disable-next-line import/no-unused-modules
export const getStatusType = (status?: TxStatus | DepositStatus | WithdrawalStatus): StatusType => {
  switch (status) {
    case 'DROPPED':
    case 'ERROR':
    case 'REJECTED':
    case 'REVERTED':
      return 'error';

    case 'PENDING':
    case 'UNCONFIRMED':
    case 'BEING_AGGREGATED':
    case 'SUBMITTED_TO_L2':
    case 'SUBMITTED_FOR_VERIFICATION':
    case 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED':
    case 'SUBMITTED_FOR_EXPANSION':
    case 'BEING_EXPANDED':
      return 'pending';

    case 'MINED':
    case 'SUCCEEDED':
    case 'AGGREGATED':
    case 'FINALIZED':
    case 'DEPOSITED':
    case 'COMPLETED':
    case 'CLOSED':
    case 'EXPANDED':
      return 'success';

    default:
      status satisfies undefined;
      return 'pending';
  }
};
