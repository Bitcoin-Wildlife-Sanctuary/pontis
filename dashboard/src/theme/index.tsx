import {useState} from 'react';
import {ThemeProvider as SCThemeProvider} from 'styled-components';

import {darkThemeColors} from './colors';

export const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
};

export const MAX_WIDTHS = {
  sm: 540,
  md: 720,
  lg: 960,
  xl: 1140,
  xxl: 1320,
};

const transitions = {
  duration: {
    slow: '400ms',
    medium: '250ms',
    fast: '125ms',
  },
  timing: {
    ease: 'ease',
    in: 'ease-in',
    out: 'ease-out',
    inOut: 'ease-in-out',
    bezierOut: 'cubic-bezier(0.25, 0.8, 0.6, 1)',
  },
};

const misc = {
  fonts: {
    Inter: 'Inter, sans-serif',
    default: 'Inter, sans-serif',
  },
  transitions,
};

export function getTheme(theme: 'dark') {
  const dark = theme === 'dark';

  return {
    dark,
    colors: dark ? darkThemeColors : darkThemeColors,
    ...misc,
  };
}

export const ThemeProvider: React.FC<React.PropsWithChildren> = ({children}) => {
  const [theme] = useState(() => getTheme('dark'));

  return <SCThemeProvider theme={theme}>{children}</SCThemeProvider>;
};
