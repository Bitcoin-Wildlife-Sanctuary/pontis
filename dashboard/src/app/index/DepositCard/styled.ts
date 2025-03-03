'use client';

import styled from 'styled-components';

import {Theme} from '@/types';

import {Flex, Text} from '../../../components';

export const Container = styled(Flex)`
  display: block;
  width: 100%;
  padding: ${({theme}) => theme.spacings.small}px;
  background-color: ${({theme}) => theme.colors.surface};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 6px;
  overflow: hidden;
`;

export const SectionTitle = styled(Text.CardValue)<{$marginBottom?: keyof Theme['spacings']}>`
  display: block;
  margin-bottom: ${({theme, $marginBottom = 'xsmall'}) => theme.spacings[$marginBottom]}px;
`;

export const TransactionCard = styled(Flex)`
  flex-direction: column;
  padding: ${({theme}) => theme.spacings.xxsmall}px;
  background-color: ${({theme}) => theme.colors.elevated};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 4px;
`;
