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

  background: '#202020',
  surface: '#242424',
  elevated: '#272727',

  text: '#DEDEDE',
  textLight: '#A0A0A0',
  textStrong: '#FAFAFA',

  border: '#3D3D3D',

  success: '#55E065',
  error: '#FF495C',
  info: '#00C3F9',
  warning: '#FFC43A',
};
