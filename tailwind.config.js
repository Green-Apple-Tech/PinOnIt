/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef0fb',
          100: '#d6daf5',
          200: '#adb5ec',
          300: '#8490e2',
          400: '#6b7bdb',
          500: '#5865c6',
          600: '#4a56b5',
          700: '#3c469f',
          800: '#2e3680',
          900: '#1e2455',
        },
      },
      keyframes: {
        coordDayIn: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        coordDayIn: 'coordDayIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
};
