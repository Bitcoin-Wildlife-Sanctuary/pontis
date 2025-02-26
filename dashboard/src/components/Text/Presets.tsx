import styled from 'styled-components';

import {TextWrapper} from './TextWrapper';

export const HeadlineLarge = styled(TextWrapper).attrs({
  color: 'textStrong',
  fontSize: 48,
  fontWeight: 700,
})``;

export const HeadlineSmall = styled(TextWrapper).attrs({
  color: 'textLight',
  fontSize: 24,
  fontWeight: 600,
})``;

export const Title = styled(TextWrapper).attrs({
  color: 'textStrong',
  fontSize: 22,
  fontWeight: 600,
})``;

export const Subtitle = styled(TextWrapper).attrs({
  color: 'textLight',
  fontSize: 16,
  fontWeight: 700,
})``;

export const Body = styled(TextWrapper).attrs({
  color: 'text',
  fontSize: 16,
  fontWeight: 400,
})``;
