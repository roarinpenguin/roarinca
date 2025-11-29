/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rpurple: {
          50: '#f5e9ff',
          100: '#ead4ff',
          200: '#d0a8ff',
          300: '#b67cff',
          400: '#9c50ff',
          500: '#8224ff',
          600: '#681bcc',
          700: '#4e1499',
          800: '#340c66',
          900: '#1b0533'
        }
      },
      boxShadow: {
        glossy: '0 0 0 1px rgba(255,255,255,0.05), 0 18px 45px rgba(0,0,0,0.85)',
      },
      borderRadius: {
        '2xl': '1.25rem',
      }
    },
  },
  plugins: [],
};
