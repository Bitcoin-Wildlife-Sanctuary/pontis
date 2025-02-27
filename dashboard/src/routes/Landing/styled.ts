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
  /* TODO: remove min-height as its temporary */
  min-height: 20px;
  background-color: ${({theme}) => theme.colors.elevated};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 8px;
  overflow: hidden;
  ${({theme, $withPadding}) => $withPadding && `padding: ${theme.spacings.small}px;`}
`;

export const ContentCardTitle = styled(Text.Title).attrs({$textAlign: 'center'})`
  display: inline-block;
  padding: ${({theme}) => theme.spacings.small}px;
`;

export const ChartCard = styled(ContentCard)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({theme}) => theme.spacings.small}px;
`;

export const GridCard = styled(ContentCard)`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  // We're using the gap to create the border, and the background color to color the gap
  gap: 1px;
  background-color: ${({theme}) => theme.colors.border};
  overflow: hidden;
`;

export const GridCardItem = styled(ContentCard)`
  display: flex;
  flex-direction: column;
  flex: 1 1 calc(50% - 2px);
  align-items: center;
  justify-content: space-between;
  padding: ${({theme}) => `${theme.spacings.medium}px ${theme.spacings.xxsmall}px`};
  gap: ${({theme}) => theme.spacings.small}px;
  background-color: ${({theme}) => theme.colors.elevated};
  border-radius: 0;
  border: 0;
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
