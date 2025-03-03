'use client';

import {createElement} from 'react';

import {type TextWrapperProps, TextWrapper} from './TextWrapper';

const createTextVariant = (variantProps: TextWrapperProps) => {
  const TextVariant = (props: React.ComponentProps<typeof TextWrapper>) => {
    return createElement(TextWrapper, {...variantProps, ...props}, props.children);
  };

  return TextVariant;
};

export const HeadlineLarge = createTextVariant({
  $color: 'textStrong',
  $fontSize: 48,
  $fontWeight: 700,
});

export const HeadlineSmall = createTextVariant({
  $color: 'textLight',
  $fontSize: 24,
  $fontWeight: 600,
});

export const Title = createTextVariant({
  $color: 'textStrong',
  $fontSize: 22,
  $fontWeight: 600,
});

export const Subtitle = createTextVariant({
  $color: 'textLight',
  $fontSize: 16,
  $fontWeight: 700,
});

export const Body = createTextVariant({
  $color: 'text',
  $fontSize: 16,
  $fontWeight: 400,
});

export const BodyStrong = createTextVariant({
  $color: 'textStrong',
  $fontSize: 16,
  $fontWeight: 600,
});

export const CardTitle = createTextVariant({
  $color: 'textLight',
  $fontSize: 14,
  $fontWeight: 700,
});

export const CardValue = createTextVariant({
  $color: 'textStrong',
  $fontSize: 15,
  $fontWeight: 700,
});
