import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'calligraphy': ['"Great Vibes"', ...defaultTheme.fontFamily.serif],
      },
      colors: {
        stone: {
          ...defaultTheme.colors.stone,
          750: '#57534e', 
          850: '#332f2c',
        },
      },
    },
  },
  plugins: [],
}