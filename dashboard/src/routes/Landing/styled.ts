import styled from 'styled-components';

import {Col} from '../../components';
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

export const ContentCard = styled.div`
  width: 100%;
  /* TODO: remove min-height as its temporary */
  min-height: 20px;
  background-color: ${({theme}) => theme.colors.elevated};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 8px;
`;

export const ChartCard = styled(ContentCard)`
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
