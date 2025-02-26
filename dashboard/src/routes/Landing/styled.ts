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
  min-height: 20px;
  background-color: ${({theme}) => theme.colors.elevated};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 8px;
`;

export const ChartCard = styled(ContentCard)`
  padding: ${({theme}) => theme.spacings.small}px;
`;
