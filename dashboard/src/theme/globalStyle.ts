import {createGlobalStyle} from 'styled-components';

import {rem} from '../utils/units';

export const GlobalStyle = createGlobalStyle`
  :root,
  .row {
    --bs-gutter-x: ${({theme}) => rem(theme.spacings.large)};
    --bs-gutter-y: 0;
  }

  .g-small,
  .gy-small {
    --bs-gutter-y: ${({theme}) => rem(theme.spacings.small)};
  }

  .g-medium,
  .gx-medium {
    --bs-gutter-x: ${({theme}) => rem(theme.spacings.medium)};
  }

  .g-medium,
  .gy-medium {
    --bs-gutter-y: ${({theme}) => rem(theme.spacings.medium)};
  }

  .g-small,
  .gx-small {
    --bs-gutter-x: ${({theme}) => rem(theme.spacings.small)};
  }

  .g-large,
  .gy-large {
    --bs-gutter-y: ${({theme}) => rem(theme.spacings.large)};
  }

  .g-large,
  .gx-large {
    --bs-gutter-x: ${({theme}) => rem(theme.spacings.large)};
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
