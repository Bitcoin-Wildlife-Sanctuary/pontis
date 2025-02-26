import {createGlobalStyle} from 'styled-components';

// eslint-disable-next-line import/no-unused-modules
export const GlobalStyle = createGlobalStyle`
  * {
    box-sizing: border-box;
    font-family: ${({theme}) => theme.fonts.default};
  }

  html {
    overflow-x: hidden;
    scroll-behavior: smooth;
    color: ${({theme}) => theme.colors.text};
    background-color: ${({theme}) => theme.colors.background} !important;
  }

  body {
    padding: 0;
    margin: 0;
  }

  html, body, #root {
    height: 100%;
  }
  
  #root {
    display: flex;
    flex-direction: column;
  }
  
  .app {
    display: flex;
    min-height: 100dvh;
    flex-direction: column;
  }
`;
