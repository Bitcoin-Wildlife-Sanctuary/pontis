import {DepositStatus, StatusType, TxStatus, WithdrawalStatus} from '@/types';

export const shortenHex = (hex?: string, partLength = 6, separator = '...'): string => {
  if (!hex) return '';

  return `${hex.slice(0, hex.startsWith('0x') ? partLength + 2 : partLength)}${separator}${hex.slice(-partLength)}`;
};

export const getTransactionStatusType = (status?: TxStatus): StatusType => {
  switch (status) {
    case 'DROPPED':
    case 'ERROR':
    case 'REJECTED':
    case 'REVERTED':
      return 'error';

    case 'PENDING':
    case 'UNCONFIRMED':
      return 'pending';

    case 'MINED':
    case 'SUCCEEDED':
      return 'success';

    default:
      status satisfies undefined;
      return 'pending';
  }
};

export const getDepositStatusType = (status?: DepositStatus): StatusType => {
  switch (status) {
    case 'BEING_AGGREGATED':
    case 'SUBMITTED_TO_L2':
    case 'DEPOSITED':
    case 'SUBMITTED_FOR_VERIFICATION':
      return 'pending';

    case 'AGGREGATED':
    case 'FINALIZED':
    case 'COMPLETED':
      return 'success';

    default:
      status satisfies undefined;
      return 'pending';
  }
};

export const getWithdrawalStatusType = (status?: WithdrawalStatus): StatusType => {
  switch (status) {
    case 'PENDING':
    case 'CLOSE_WITHDRAWAL_BATCH_SUBMITTED':
    case 'BEING_EXPANDED':
      return 'pending';

    case 'CLOSED':
    case 'EXPANDED':
      return 'success';

    default:
      status satisfies undefined;
      return 'pending';
  }
};
