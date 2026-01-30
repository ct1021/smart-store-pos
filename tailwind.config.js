/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF3B30', // The specific Red from the dark mode UI
          hover: '#d93229',
          light: '#ff6b62'
        },
        zinc: {
          850: '#1f1f22',
          900: '#18181b',
          950: '#09090b' // Deep dark background
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}