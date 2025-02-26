import type {Property} from 'csstype';
import styled from 'styled-components';

export const Flex = styled.div<{
  gap?: number;
  flex?: number;
  justify?: Property.JustifyContent;
  alignItems?: Property.AlignItems;
}>`
  display: flex;
  ${({gap}) => gap && `gap: ${gap}px;`}
  ${({flex}) => flex && `flex: ${flex};`}
  justify-content: ${({justify = 'initial'}) => justify};
  align-items: ${({alignItems = 'initial'}) => alignItems};
`;
