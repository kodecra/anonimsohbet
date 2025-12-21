import { createTheme, DEFAULT_THEME } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'violet',
  colors: {
    violet: [
      '#f3f0ff',
      '#e5dbff',
      '#d0bfff',
      '#b197fc',
      '#9775fa',
      '#845ef7',
      '#7950f2',
      '#7048e8',
      '#6741d9',
      '#5f3dc4',
    ],
  },
  fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
    fontWeight: '700',
  },
  radius: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },
  shadows: {
    md: '0 4px 12px rgba(0, 0, 0, 0.15)',
    xl: '0 10px 30px rgba(0, 0, 0, 0.25)',
  },
  defaultRadius: 'md',
});

