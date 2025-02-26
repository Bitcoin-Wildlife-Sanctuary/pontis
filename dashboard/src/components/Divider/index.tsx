import styled from 'styled-components';

import {Theme} from '../../types';

// eslint-disable-next-line import/no-unused-modules
export const Divider = styled.div<{$marginTop?: keyof Theme['spacings']; $marginBottom?: keyof Theme['spacings']}>`
  width: 100%;
  height: 1px;
  background-color: ${({theme}) => theme.colors.border};
  margin-top: ${({theme, $marginTop = 'none'}) => theme.spacings[$marginTop]}px;
  margin-bottom: ${({theme, $marginBottom = 'none'}) => theme.spacings[$marginBottom]}px;
`;
