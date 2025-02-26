import {StrictMode} from 'react';
import {BrowserRouter} from 'react-router-dom';

import {ThemeProvider} from '../theme';
import {GlobalStyle} from '../theme/globalStyle';

export const Wrapper: React.FC<React.PropsWithChildren> = ({children}) => {
  return (
    <StrictMode>
      <ThemeProvider>
        <GlobalStyle />

        <BrowserRouter>{children}</BrowserRouter>
      </ThemeProvider>
    </StrictMode>
  );
};
