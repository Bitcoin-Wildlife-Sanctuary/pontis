import Color from 'color';
import styled, {css} from 'styled-components';

import {StatusType} from '@/types';

import {Text} from '../Text';

const darkenColor = (color: string, ratio = 0.5) => Color(color).darken(ratio).string();
const alphaColor = (color: string, value = 0.15) => Color(color).alpha(value).string();

export const StyledStatusChip = styled(Text.Title).attrs((props) => ({
  ...props,
  $fontSize: 12,
}))<{$status: StatusType}>`
  display: inline-block;
  padding: ${({theme}) => `${theme.spacings.xsmall / 2}px ${theme.spacings.xsmall}px`};
  color: ${({theme, $status}) => (theme.dark ? theme.colors[$status] : darkenColor(theme.colors[$status]))};
  background-color: ${({theme, $status}) => alphaColor(theme.colors[$status])};
  border: 1px solid ${({theme, $status}) => (theme.dark ? darkenColor(theme.colors[$status]) : theme.colors[$status])};
  border-radius: 4px;
  will-change: opacity, box-shadow, text-shadow;

  ${({theme, $status}) =>
    $status === 'pending'
      ? css`
          animation: ${theme.animations.pulse(
              theme.colors[$status],
              alphaColor(darkenColor(theme.colors[$status]), 0.6),
            )}
            2s ${theme.transitions.timing.inOut} infinite alternate;
        `
      : ''}
`;
