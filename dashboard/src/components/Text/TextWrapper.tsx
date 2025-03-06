'use client';

import type {Globals, Property} from 'csstype';
import styled from 'styled-components';

import {px, rem} from '@/utils/units';

import {Theme} from '../../types';

export type TextWrapperProps = {
  $color?: keyof Theme['colors'] | Globals;
  $fontFamily?: keyof Theme['fonts'];
  $fontWeight?: number;
  $fontSize?: number;
  $lineHeight?: number;
  $letterSpacing?: number;
  $textAlign?: Property.TextAlign;
};

export const TextWrapper = styled.span<TextWrapperProps>`
  color: ${({theme, $color = 'text'}) => theme.colors[$color as keyof Theme['colors']] ?? $color};
  ${({$fontFamily}) => ($fontFamily ? `font-family: '${$fontFamily}';` : '')}
  ${({$fontWeight}) => ($fontWeight ? `font-weight: ${$fontWeight};` : '')}
  ${({$fontSize}) => ($fontSize ? `font-size: ${rem($fontSize)};` : '')}
  ${({$lineHeight}) => ($lineHeight ? `line-height: ${rem($lineHeight)};` : '')}
  ${({$letterSpacing}) => ($letterSpacing ? `letter-spacing: ${px($letterSpacing)};` : '')}
  ${({$textAlign}) => ($textAlign ? `text-align: ${$textAlign};` : '')}
`;
