/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          dark: 'var(--app-dark)',
          darker: 'var(--app-darker)',
          channel: 'var(--app-channel)',
          hover: 'var(--app-hover)',
          accent: 'var(--app-accent)',
          'accent-hover': 'var(--app-accent-hover)',
          text: 'var(--app-text)',
          muted: 'var(--app-muted)',
          online: '#23a559',
          offline: '#80848e',
        }
      }
    },
  },
  plugins: [],
}
