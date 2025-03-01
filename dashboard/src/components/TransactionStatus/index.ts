'use client';

import styled from 'styled-components';

import {StatusType} from '../../types';

export const TransactionStatus = styled.div<{$status: StatusType; $size?: number}>`
  display: inline-block;
  width: ${({$size = 12}) => `${$size}px`};
  height: ${({$size = 12}) => `${$size}px`};
  background-color: ${({theme, $status}) => {
    const colors = {
      success: theme.colors.success,
      error: theme.colors.error,
      pending: theme.colors.warning,
    } satisfies Record<StatusType, string>;

    return colors[$status];
  }};
  border-radius: 50%;
`;
