/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#2563eb',
          600: '#1d4ed8',
        },
      },
      boxShadow: {
        focus: '0 0 0 3px rgba(37, 99, 235, 0.45)',
      },
    },
  },
  plugins: [],
};