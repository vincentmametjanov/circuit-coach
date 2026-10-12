import { Platform } from 'react-native';

// Palette modeled on the Arduino IDE: dark teal chrome, white editor, black console.
export const colors = {
  titleBar: '#003F42',
  toolbar: '#006468',
  toolbarButton: '#4DB7BB',
  toolbarButtonIcon: '#003F42',
  toolbarButtonHover: '#FFFFFF',
  tabStrip: '#17A1A5',
  tabInactive: '#4DB7BB',
  tabText: '#FFFFFF',
  tabActiveText: '#00494C',
  editor: '#FFFFFF',
  gutter: '#F4F7F7',
  gutterText: '#9AA6A6',
  canvas: '#EEF3F3',
  canvasDot: '#CCD9D9',
  panel: '#F7F9F9',
  panelBorder: '#DAE3E3',
  activityBar: '#E4ECEC',
  text: '#374146',
  textMuted: '#7F8C8D',
  teal: '#00979C',
  tealDark: '#006468',
  tealPale: '#E1F2F2',
  console: '#000000',
  consoleHeader: '#1F2526',
  consoleText: '#E8ECEC',
  consoleMuted: '#8A9A9A',
  consoleSuccess: '#4DB7BB',
  consoleWarn: '#F5B041',
  consoleError: '#FF6B57',
  statusBar: '#006468',
  statusText: '#E1F2F2',
  success: '#2E9E5B',
  danger: '#D64532',
};

// Arduino IDE syntax colors.
export const syntax = {
  text: '#434F54',
  type: '#00979C',
  structure: '#5E6D03',
  function: '#D35400',
  constant: '#00979C',
  number: '#434F54',
  comment: '#95A5A6',
};

export const fonts = {
  ui: Platform.select({
    web: '"Open Sans", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
    default: undefined,
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: '"Source Code Pro", Menlo, Consolas, "Courier New", monospace',
  }),
  svg: 'Helvetica',
};
