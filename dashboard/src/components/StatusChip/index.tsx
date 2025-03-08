'use client';

import {useMemo} from 'react';

import {DepositStatus, WithdrawalStatus} from '@/types';
import {getDepositStatusType, getWithdrawalStatusType} from '@/utils/format';

import {StyledStatusChip} from './styled';

type StatusChipProps =
  | {
      type: 'deposit';
      status: DepositStatus;
    }
  | {
      type: 'withdrawal';
      status: WithdrawalStatus;
    };

export const StatusChip: React.FC<StatusChipProps> = (props) => {
  const status = useMemo(() => {
    if (props.type === 'deposit') {
      return getDepositStatusType(props.status);
    }

    return getWithdrawalStatusType(props.status);
  }, [props.type, props.status]);

  return <StyledStatusChip $status={status}>{props.status}</StyledStatusChip>;
};
