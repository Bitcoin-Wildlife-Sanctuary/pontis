import type {Property} from 'csstype';
import styled from 'styled-components';

import {Theme} from '../../types';

export const Flex = styled.div<{
  $flex?: Property.Flex;
  $gap?: number | keyof Theme['spacings'];
  $justify?: Property.JustifyContent;
  $alignItems?: Property.AlignItems;
}>`
  display: flex;
  ${({theme, $gap}) => $gap && (typeof $gap === 'number' ? `gap: ${$gap}px;` : `gap: ${theme.spacings[$gap]}px;`)}
  ${({$flex}) => $flex && `flex: ${$flex};`}
  justify-content: ${({$justify = 'initial'}) => $justify};
  align-items: ${({$alignItems = 'initial'}) => $alignItems};
`;
