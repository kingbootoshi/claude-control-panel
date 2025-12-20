/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          deep: '#0a0b0d',
          surface: '#0f1012',
          elevated: '#151719',
          border: '#1e2024',
        },
        teal: {
          DEFAULT: '#14b8a6',
          dim: '#0d9488',
        },
        amber: {
          DEFAULT: '#f59e0b',
          dim: '#92400e',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
