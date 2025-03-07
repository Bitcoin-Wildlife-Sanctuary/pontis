'use client';

import styled from 'styled-components';

import {type TextWrapperProps, TextWrapper} from './TextWrapper';

const createTextVariant = (variantProps: TextWrapperProps) => {
  return styled(TextWrapper).attrs((props) => ({
    ...variantProps,
    ...props,
  }))``;
};

export const HeadlineLarge = createTextVariant({
  $color: 'textStrong',
  $fontSize: 42,
  $fontWeight: 700,
});

export const HeadlineSmall = createTextVariant({
  $color: 'textLight',
  $fontSize: 21,
  $fontWeight: 600,
});

export const Title = createTextVariant({
  $color: 'textHighlight',
  $fontSize: 15,
  $fontWeight: 500,
});

export const Subtitle = createTextVariant({
  $color: 'textLight',
  $fontSize: 12,
  $fontWeight: 400,
  $letterSpacing: 0.5,
});

export const Body = createTextVariant({
  $color: 'text',
  $fontSize: 14.5,
  $fontWeight: 400,
});

export const BodyStrong = createTextVariant({
  $color: 'textHighlight',
  $fontSize: 14.5,
  $fontWeight: 400,
});

export const CardTitle = createTextVariant({
  $color: 'textLight',
  $fontSize: 13.5,
  $fontWeight: 500,
});

export const CardValue = createTextVariant({
  $color: 'textStrong',
  $fontSize: 14.5,
  $fontWeight: 400,
});
