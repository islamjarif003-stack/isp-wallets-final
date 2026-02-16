import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d8f1ff',
          200: '#b9e7ff',
          300: '#89d9ff',
          400: '#52c2ff',
          500: '#2aa2ff',
          600: '#1484f5',
          700: '#0d6de1',
          800: '#1158b6',
          900: '#144b8f',
        },
      },
    },
  },
  plugins: [],
};
export default config;