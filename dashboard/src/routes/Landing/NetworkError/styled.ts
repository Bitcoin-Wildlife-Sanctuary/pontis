import styled from 'styled-components';

export const Container = styled.div`
  padding: ${({theme}) => `${theme.spacings.medium}px ${theme.spacings.large}px`};
  background-color: ${({theme}) => `${theme.colors.error}`};
  border-radius: 8px;
`;
