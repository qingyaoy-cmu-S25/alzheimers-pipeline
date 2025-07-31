/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'colab-gray': '#fafafa',
        'colab-border': '#e0e0e0',
        'colab-blue': '#1976d2',
        'code-bg': '#f5f5f5',
      },
    },
  },
  plugins: [],
}