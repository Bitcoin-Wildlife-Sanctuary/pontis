'use client';

import Color from 'color';
import styled, {css} from 'styled-components';

import {StatusType} from '../../types';

export const TransactionStatus = styled.div<{$status: StatusType; $size?: number}>`
  display: inline-block;
  width: ${({$size = 12}) => `${$size}px`};
  height: ${({$size = 12}) => `${$size}px`};
  border-radius: 50%;
  background-color: ${({theme, $status}) => Color(theme.colors[$status]).string()};
  will-change: opacity, box-shadow;

  ${({theme, $status}) =>
    $status === 'pending'
      ? css`
          animation: ${theme.animations.pulse(theme.colors[$status])} 2s ${theme.transitions.timing.inOut} infinite
            alternate;
        `
      : ''}
`;
