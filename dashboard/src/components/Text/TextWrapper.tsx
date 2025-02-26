import type {Property} from 'csstype';
import styled from 'styled-components';

import {Theme} from '../../types';

export type TextWrapperProps = {
  color?: keyof Theme['colors'];
  fontFamily?: keyof Theme['fonts'];
  fontWeight?: number;
  fontSize?: number;
  lineHeight?: number;
  textAlign?: Property.TextAlign;
};

export const TextWrapper = styled.span<TextWrapperProps>`
  color: ${({theme, color = 'text'}) => theme.colors[color]};
  ${({fontFamily}) => (fontFamily ? `font-family: '${fontFamily}';` : '')}
  ${({fontWeight}) => (fontWeight ? `font-weight: ${fontWeight};` : '')}
  ${({fontSize}) => (fontSize ? `font-size: ${fontSize}px;` : '')}
  ${({lineHeight}) => (lineHeight ? `line-height: ${lineHeight}px;` : '')}
  ${({textAlign}) => (textAlign ? `text-align: ${textAlign};` : '')}
`;
