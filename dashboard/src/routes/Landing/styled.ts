import styled from 'styled-components';

import {Col, Flex, Text} from '../../components';
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

export const LogoImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
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

export const TransactionsContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  grid-auto-columns: auto auto;
  grid-auto-rows: auto auto;
  grid-auto-flow: row;
  grid-template-areas:
    'pending withdrawals'
    'deposits withdrawals';

  flex: 1;
  max-height: 840px;
  gap: ${({theme}) => theme.spacings.large}px;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    grid-template-areas:
      'pending'
      'deposits'
      'withdrawals';

    max-height: 1640px;
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

export const SectionCard = styled(ContentCard)`
  min-height: 360px;
  overflow-y: scroll;
`;

export const SectionCardTitle = styled(Text.Title).attrs({$textAlign: 'center'})`
  display: inline-block;
  padding: ${({theme}) => theme.spacings.small}px;
`;

export const Table = styled.table`
  border-collapse: collapse;

  tr {
    border-bottom: 1px solid ${({theme}) => theme.colors.border};
  }

  th,
  td {
    padding: ${({theme}) => `${theme.spacings.small}px ${theme.spacings.medium}px`};
    text-align: left;
  }
`;
