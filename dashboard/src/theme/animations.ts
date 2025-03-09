import {keyframes} from 'styled-components';

export const pulse = (color: string, textColor?: string) => keyframes`
  from {
    opacity: 1;
    box-shadow: 0 0 3px 1px ${color};
    ${textColor ? `text-shadow: 0 0 4px ${color};` : ''}
  }
  to {
    opacity: 0.75;
    box-shadow: 0 0 0 0 ${color};
    ${textColor ? `text-shadow: 0 0 0 ${color};` : ''}
  }
`;
