'use client';

import Image from 'next/image';
import styled from 'styled-components';

import {Text} from '@/components';

export const LogoImage = styled(Image)`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const Title = styled(Text.Subtitle)``;

export const Value = styled(Text.Title)`
  font-weight: 400;
`;
