import styled from 'styled-components';

import {Flex, Text} from '../../../components';

export const Container = styled(Flex)`
  display: block;
  width: 100%;
  padding: ${({theme}) => theme.spacings.small}px;
  background-color: ${({theme}) => theme.colors.surface};
  border: 1px solid ${({theme}) => theme.colors.border};
  border-radius: 6px;
  overflow: hidden;
`;

export const SectionTitle = styled(Text.CardValue)`
  display: block;
  margin-bottom: ${({theme}) => theme.spacings.xsmall}px;
`;
