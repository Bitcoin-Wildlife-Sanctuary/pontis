'use client';

import styled from 'styled-components';

import {Flex, Text} from '../../../components';

export const Container = styled(Flex)`
  display: block;
  width: 100%;
  background-color: ${({theme}) => theme.colors.surface};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 6px;
  overflow: hidden;
`;

export const SectionTitleContainer = styled(Flex)`
  width: 100%;
  padding: ${({theme}) => `${theme.spacings.small}px ${theme.spacings.medium}px`};
  background-color: ${({theme}) => theme.colors.background};
  border-bottom: 1px solid ${({theme}) => theme.colors.border};
`;

export const SectionTitle = styled(Text.Title).attrs({$fontWeight: 600})`
  display: block;
`;

export const TransactionCard = styled(Flex)`
  flex-direction: column;
  padding: ${({theme}) => theme.spacings.xxsmall}px;
  background-color: ${({theme}) => theme.colors.elevated};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 4px;
`;
