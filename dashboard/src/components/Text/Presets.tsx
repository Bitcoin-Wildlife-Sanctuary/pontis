import styled from 'styled-components';

import {type TextWrapperProps, TextWrapper} from './TextWrapper';

const createTextVariant = (props: TextWrapperProps) => {
  const Variant = styled(TextWrapper)``;
  Variant.defaultProps = props;
  return Variant;
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
