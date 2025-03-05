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
  $fontSize: 42,
  $fontWeight: 700,
});

export const HeadlineSmall = createTextVariant({
  $color: 'textLight',
  $fontSize: 21,
  $fontWeight: 600,
});

export const Title = createTextVariant({
  $color: 'textStrong',
  $fontSize: 20,
  $fontWeight: 600,
});

export const Subtitle = createTextVariant({
  $color: 'textLight',
  $fontSize: 14.5,
  $fontWeight: 700,
});

export const Body = createTextVariant({
  $color: 'text',
  $fontSize: 14.5,
  $fontWeight: 400,
});

export const BodyStrong = createTextVariant({
  $color: 'textStrong',
  $fontSize: 14.5,
  $fontWeight: 600,
});

export const CardTitle = createTextVariant({
  $color: 'textLight',
  $fontSize: 13.5,
  $fontWeight: 700,
});

export const CardValue = createTextVariant({
  $color: 'textStrong',
  $fontSize: 14.5,
  $fontWeight: 700,
});
