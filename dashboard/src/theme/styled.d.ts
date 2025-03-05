import {getTheme} from './index';

type ThemeType = ReturnType<typeof getTheme>;

declare module 'styled-components' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface DefaultTheme extends ThemeType {}
}
