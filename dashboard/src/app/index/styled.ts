'use client';

import styled from 'styled-components';

import {Col, Flex, Table as TableComponent, Text} from '../../components';
import {BREAKPOINTS, PAGE_PADDINGS} from '../../theme';

export const Container = styled(Col)`
  ${Object.entries(BREAKPOINTS).map(([key, breakpoint]) => {
    const padding = PAGE_PADDINGS[key as keyof typeof BREAKPOINTS];

    return `
      @media (min-width: ${breakpoint}px) {
        padding-top: ${padding}px;
        padding-bottom: ${padding}px;
        gap: ${padding}px;
      }
    `;
  })}
`;

export const ContentCard = styled(Flex)<{$surface?: boolean}>`
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: ${({theme, $surface}) => theme.colors[$surface ? 'surface' : 'elevated']};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 8px;
  overflow: hidden;
`;

// eslint-disable-next-line import/no-unused-modules
export const HistoryContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
  grid-auto-columns: auto auto;
  grid-auto-rows: auto;
  grid-auto-flow: row;
  grid-template-areas: 'deposits withdrawals';

  flex: 1;
  gap: ${({theme}) => theme.spacings.large}px;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    grid-template-areas:
      'deposits'
      'withdrawals';
  }

  .pending {
    grid-area: pending;
  }

  .deposits {
    grid-area: deposits;
  }

  .withdrawals {
    grid-area: withdrawals;
  }
`;

export const HistorySectionContainer = styled(Col)`
  padding: ${({theme}) => theme.spacings.small}px;
  padding-top: 0;
  gap: ${({theme}) => theme.spacings.small}px;
`;

export const SectionCard = styled(ContentCard)`
  min-height: 240px;
`;

export const SectionCardTitle = styled(Text.Title).attrs({$textAlign: 'center'})`
  display: inline-block;
  padding: ${({theme}) => theme.spacings.small}px;
  margin-bottom: ${({theme}) => theme.spacings.small}px;
  background-color: ${({theme}) => theme.colors.background};
  border-bottom: 1px solid ${({theme}) => theme.colors.border};
`;

export const Table = styled(TableComponent)`
  th,
  td {
    padding: ${({theme}) => `${theme.spacings.xsmall}px ${theme.spacings.small}px`};
  }
`;
