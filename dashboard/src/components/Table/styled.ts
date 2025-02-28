import styled from 'styled-components';

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  tr {
    border-bottom: 1px solid ${({theme}) => theme.colors.border};
  }

  th,
  td {
    padding: ${({theme}) => `${theme.spacings.xxsmall}px ${theme.spacings.xsmall}px`};
    text-align: left;
  }
`;
