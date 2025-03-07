'use client';

import {useMemo} from 'react';
import {useTheme} from 'styled-components';

import {DepositStatus, StatusType, WithdrawalStatus} from '@/types';
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
  const theme = useTheme();

  const status = useMemo(() => {
    if (props.type === 'deposit') {
      return getDepositStatusType(props.status);
    }

    return getWithdrawalStatusType(props.status);
  }, [props.type, props.status]);

  const color = useMemo(() => {
    const colors = {
      pending: theme.colors.warning,
      success: theme.colors.success,
      error: theme.colors.error,
    } satisfies Record<StatusType, string>;

    return colors[status];
  }, [status, theme.colors]);

  return <StyledStatusChip color={color}>{props.status}</StyledStatusChip>;
};
