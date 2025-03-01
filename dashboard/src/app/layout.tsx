// We can disregard this warning, as it's a css file
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import 'bootstrap/dist/css/bootstrap-grid.css';
import '@csstools/normalize.css';

import type {Metadata, Viewport} from 'next';
import {Inter} from 'next/font/google';

import {ThemeProvider} from '@/theme';
import {GlobalStyle} from '@/theme/globalStyle';
import StyledComponentsRegistry from '@/theme/registry';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin-ext'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Pontis - OP_CAT enabled Bitcoin <> Starknet Bridge',
  description: 'OP_CAT enabled Bitcoin <> Starknet Bridge',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <StyledComponentsRegistry>
          <ThemeProvider>
            <GlobalStyle />

            {children}
          </ThemeProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
