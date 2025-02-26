import {createGlobalStyle} from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  :root {
    // TODO: change these values to match the theme spacings
    --bs-gutter-x: 1.5rem;
    --bs-gutter-y: 0;
  }

  .gy-large {
    // TODO: change these values to match the theme spacings
    --bs-gutter-y: 1rem;
  }

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

  h1, h2, h3, h4, h5, h6 {
    margin: 0;
    margin-block: 0;
  }

  a {
    color: ${({theme}) => theme.colors.link};
    text-decoration: none;
    transition: ${({theme}) => theme.transitions.duration.medium} ${({theme}) => theme.transitions.timing.bezierOut};
  }

  a:hover {
    color: ${({theme}) => theme.colors.linkHover};
  }
`;
