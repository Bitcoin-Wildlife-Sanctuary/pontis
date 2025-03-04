import {createContext, useContext} from 'react';

type ToggleThemeContextType = {
  toggleTheme: () => void;
};

export const ToggleThemeContext = createContext<ToggleThemeContextType>({
  toggleTheme: () => {
    // noop
  },
});

export const useToggleTheme = () => {
  return useContext(ToggleThemeContext).toggleTheme;
};
