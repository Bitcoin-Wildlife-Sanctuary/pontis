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

export const ContentCard = styled(Flex)<{$withPadding?: boolean}>`
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: ${({theme}) => theme.colors.elevated};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 8px;
  overflow: hidden;
  ${({theme, $withPadding}) => $withPadding && `padding: ${theme.spacings.small}px;`}
`;

// eslint-disable-next-line import/no-unused-modules
export const HistoryContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto 1fr;
  grid-auto-columns: auto auto;
  grid-auto-rows: auto auto;
  grid-auto-flow: row;
  grid-template-areas:
    'pending withdrawals'
    'deposits withdrawals';

  flex: 1;
  gap: ${({theme}) => theme.spacings.large}px;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas:
      'pending'
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
  border-bottom: 1px solid ${({theme}) => theme.colors.border};
`;

export const Table = styled(TableComponent)`
  thead {
    background-color: ${({theme}) => theme.colors.elevated};
    position: sticky;
    top: 0;
  }

  th,
  td {
    padding: ${({theme}) => `${theme.spacings.small}px ${theme.spacings.medium}px`};
  }
`;
