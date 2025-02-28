import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {StrictMode} from 'react';
import {BrowserRouter} from 'react-router-dom';

import {ThemeProvider} from '../theme';
import {GlobalStyle} from '../theme/globalStyle';

const queryClient = new QueryClient();

export const Wrapper: React.FC<React.PropsWithChildren> = ({children}) => {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <GlobalStyle />

          <BrowserRouter>{children}</BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  );
};
