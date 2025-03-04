// We can disregard this warning, as it's a css file
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import 'bootstrap/dist/css/bootstrap-grid.css';
import '@csstools/normalize.css';

import type {Metadata, Viewport} from 'next';
import {Roboto} from 'next/font/google';
import {cookies} from 'next/headers';

import {ThemeProvider} from '@/theme';
import {GlobalStyle} from '@/theme/globalStyle';
import StyledComponentsRegistry from '@/theme/registry';

const roboto = Roboto({
  variable: '--font-roboto',
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme');

  let initialTheme: 'light' | 'dark' = 'light';
  if (themeCookie?.value && (themeCookie.value === 'dark' || themeCookie.value === 'light')) {
    initialTheme = themeCookie.value;
  }

  return (
    <html lang="en">
      <body className={roboto.variable}>
        <StyledComponentsRegistry>
          <ThemeProvider initialTheme={initialTheme}>
            <GlobalStyle />

            {children}
          </ThemeProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
