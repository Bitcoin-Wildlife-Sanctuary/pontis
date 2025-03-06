import Color from 'color';
import styled from 'styled-components';

import {Text} from '../Text';

export const StyledStatusChip = styled(Text.Title).attrs((props) => ({
  ...props,
  $fontSize: 12,
}))<{color: string}>`
  display: inline-block;
  padding: ${({theme}) => `${theme.spacings.xsmall / 2}px ${theme.spacings.xsmall}px`};
  color: ${({theme, color}) => (theme.dark ? color : Color(color).darken(0.5).string())};
  background-color: ${({color}) => Color(color).alpha(0.15).string()};
  border: 1px solid ${({theme, color}) => (theme.dark ? Color(color).darken(0.5).string() : color)};
  border-radius: 4px;
`;
