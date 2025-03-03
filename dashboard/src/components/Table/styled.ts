'use client';

import styled from 'styled-components';

export const Container = styled.div`
  width: 100%;
  max-width: 100%;
  overflow: auto;
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  tr {
    border-bottom: 1px solid ${({theme}) => theme.colors.border};
  }

  tbody tr:last-child {
    border-bottom: 0;
  }

  th,
  td {
    padding: ${({theme}) => `${theme.spacings.xxsmall}px ${theme.spacings.xsmall}px`};
    text-align: left;
  }

  td {
    word-break: break-all;
    overflow-wrap: break-word;
  }
`;
