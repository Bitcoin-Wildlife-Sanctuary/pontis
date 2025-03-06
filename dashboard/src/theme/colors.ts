const commonColors = {
  transparent: 'transparent',
  blackTransparent: 'rgba(0, 0, 0, 0)',
  whiteTransparent: 'rgba(255, 255, 255, 0)',
  centerTransparent: 'rgba(127, 127, 127, 0)',

  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#00FF00',
  blue: '#0000FF',
};

export const darkThemeColors = {
  ...commonColors,

  primary: '#f7931a',
  onPrimary: '#FAFAFA',

  background: '#121212',
  surface: '#181818',
  elevated: '#1b1b1b',

  text: '#DEDEDE',
  textLight: '#A0A0A0',
  textStrong: '#FAFAFA',
  textHighlight: '#FFFFFF',

  link: '#00C3F9',
  linkHover: '#2774D4',

  border: '#343434',

  success: '#55E065',
  error: '#FF495C',
  info: '#00C3F9',
  warning: '#FFC43A',
};

export const lightThemeColors = {
  ...commonColors,

  primary: '#f7931a',
  onPrimary: '#FAFAFA',

  background: '#efeeef',
  surface: '#fbfbfb',
  elevated: '#ffffff',

  text: '#242424',
  textLight: '#6C757D',
  textStrong: '#212121',
  textHighlight: '#212529',

  link: '#0098D6',
  linkHover: '#005190',

  border: '#ebebeb',

  success: '#55E065',
  error: '#FF495C',
  info: '#00C3F9',
  warning: '#FFC43A',
};
