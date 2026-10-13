/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        thai: ["Mitr", "Sarabun", "Thai sans-serif"],
      },
    },
  },
  plugins: [],
}