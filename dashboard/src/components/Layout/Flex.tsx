'use client';

import type {Property} from 'csstype';
import styled from 'styled-components';

import {Theme} from '../../types';

export const Flex = styled.div<{
  $flex?: Property.Flex;
  $gap?: number | keyof Theme['spacings'];
  $justify?: Property.JustifyContent;
  $alignItems?: Property.AlignItems;
  $padding?: number | keyof Theme['spacings'];
  $margin?: number | keyof Theme['spacings'];
}>`
  display: flex;
  ${({theme, $gap}) => $gap && `gap: ${typeof $gap === 'number' ? $gap : theme.spacings[$gap]}px;`}
  ${({$flex}) => $flex && `flex: ${$flex};`}
  ${({$justify}) => $justify && `justify-content: ${$justify};`}
  ${({$alignItems}) => $alignItems && `align-items: ${$alignItems};`}

  ${({theme, $padding}) =>
    $padding && `padding: ${typeof $padding === 'number' ? $padding : theme.spacings[$padding]}px;`}
  ${({theme, $margin}) => $margin && `margin: ${typeof $margin === 'number' ? $margin : theme.spacings[$margin]}px;`}
`;
