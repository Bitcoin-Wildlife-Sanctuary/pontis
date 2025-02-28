import styled from 'styled-components';

import {Col, Flex, Text} from '../../components';
import {BREAKPOINTS, PAGE_PADDINGS} from '../../theme';

const HISTORY_CARD_MAX_HEIGHT = 540;

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

// eslint-disable-next-line import/no-unused-modules
export const HistoryContainer = styled.div`
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
  gap: ${({theme}) => theme.spacings.large}px;

  @media (max-width: ${BREAKPOINTS.lg}px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr 1fr;
    grid-template-areas:
      'pending'
      'deposits'
      'withdrawals';
  }

  .pending {
    grid-area: pending;
    max-height: ${HISTORY_CARD_MAX_HEIGHT}px;
  }

  .deposits {
    grid-area: deposits;
    max-height: ${HISTORY_CARD_MAX_HEIGHT}px;
  }

  .withdrawals {
    grid-area: withdrawals;
    max-height: ${({theme}) => HISTORY_CARD_MAX_HEIGHT * 2 + theme.spacings.large}px;
  }
`;

export const SectionCard = styled(ContentCard)`
  min-height: 360px;
`;

export const SectionCardTitle = styled(Text.Title).attrs({$textAlign: 'center'})`
  display: inline-block;
  padding: ${({theme}) => theme.spacings.small}px;
  margin-bottom: ${({theme}) => theme.spacings.small}px;
  border-bottom: 1px solid ${({theme}) => theme.colors.border};
`;

export const ScrollableContainer = styled(Col)`
  height: 100%;
  overflow-y: scroll;
`;

export const Table = styled.table`
  border-collapse: collapse;

  tr {
    border-bottom: 1px solid ${({theme}) => theme.colors.border};
  }

  thead {
    background-color: ${({theme}) => theme.colors.elevated};
    position: sticky;
    top: 0;
  }

  th,
  td {
    padding: ${({theme}) => `${theme.spacings.small}px ${theme.spacings.medium}px`};
    text-align: left;
  }
`;

export const DepositsContainer = styled(Col)`
  padding: ${({theme}) => theme.spacings.small}px;
  padding-top: 0;
  gap: ${({theme}) => theme.spacings.small}px;
`;
