'use client';

import {useCallback, useMemo, useState} from 'react';
import {ThemeProvider as SCThemeProvider} from 'styled-components';

import {ToggleThemeContext} from '@/hooks/useToggleTheme';

import {darkThemeColors, lightThemeColors} from './colors';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
} satisfies Record<Size, number>;

export const MAX_WIDTHS = {
  xs: 540,
  sm: 540,
  md: 720,
  lg: 960,
  xl: 1140,
  xxl: 1320,
} satisfies Record<Size, number>;

export const PAGE_PADDINGS = {
  xs: 16,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 64,
} satisfies Record<Size, number>;

const spacings = {
  none: 0,
  xxsmall: 6,
  xsmall: 8,
  small: 12,
  medium: 16,
  large: 24,
  xlarge: 32,
  xxlarge: 64,
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
    Inter: 'var(--font-roboto)',
    default: 'var(--font-roboto)',
  },
  transitions,
  spacings,
};

export function getTheme(theme: 'dark' | 'light') {
  const dark = theme === 'dark';

  return {
    dark,
    colors: dark ? darkThemeColors : lightThemeColors,
    ...misc,
  };
}

export function ThemeProvider({children}: React.PropsWithChildren) {
  const [theme, setTheme] = useState(() => getTheme('light'));

  const toggleTheme = useCallback(() => {
    if (theme.dark) {
      setTheme(getTheme('light'));
    } else {
      setTheme(getTheme('dark'));
    }
  }, [theme.dark, setTheme]);

  const toggleThemeContextValue = useMemo(() => ({toggleTheme}), [toggleTheme]);

  return (
    <ToggleThemeContext.Provider value={toggleThemeContextValue}>
      <SCThemeProvider theme={theme}>{children}</SCThemeProvider>
    </ToggleThemeContext.Provider>
  );
}
