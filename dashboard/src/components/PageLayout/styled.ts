import styled from 'styled-components';

import {BREAKPOINTS, MAX_WIDTHS, PAGE_PADDINGS} from '../../theme';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-right: auto;
  margin-left: auto;

  ${Object.entries(MAX_WIDTHS).map(
    ([key, maxWidth]) => `
      @media (min-width: ${BREAKPOINTS[key as keyof typeof MAX_WIDTHS]}px) {
        ${key === 'xs' ? 'max-width: 100%;' : `max-width: ${maxWidth}px;`}

        padding-left: ${PAGE_PADDINGS[key as keyof typeof MAX_WIDTHS]}px;
        padding-right: ${PAGE_PADDINGS[key as keyof typeof MAX_WIDTHS]}px;
      }
    `,
  )}
`;
