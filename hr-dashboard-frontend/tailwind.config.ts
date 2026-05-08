import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00152a',
        primaryContainer: '#102a43',
        secondary: '#44617d',
        tertiaryMint: '#44ddc1',
        surface: '#f6fafe',
        panel: '#ffffff',
        line: '#c3c6ce',
      },
      fontFamily: {
        heading: ['Manrope', 'sans-serif'],
        body: ['Public Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
