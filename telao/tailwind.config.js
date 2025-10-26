/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B35',
        secondary: '#F7931E',
        dark: '#1A1A2E',
        light: '#F8F9FA',
      },
    },
  },
  plugins: [],
};
