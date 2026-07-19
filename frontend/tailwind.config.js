/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Syne', 'Figtree', 'ui-sans-serif', 'sans-serif'],
      },
      colors: {
        app: {
          // Space-separated RGB channels so opacity modifiers (/50, /80) work.
          // Set in :root / userPrefs as e.g. --app-dark: 30 31 34;
          dark: 'rgb(var(--app-dark) / <alpha-value>)',
          darker: 'rgb(var(--app-darker) / <alpha-value>)',
          channel: 'rgb(var(--app-channel) / <alpha-value>)',
          hover: 'rgb(var(--app-hover) / <alpha-value>)',
          accent: 'rgb(var(--app-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--app-accent-hover) / <alpha-value>)',
          text: 'rgb(var(--app-text) / <alpha-value>)',
          muted: 'rgb(var(--app-muted) / <alpha-value>)',
          online: '#23a559',
          offline: '#80848e',
        }
      }
    },
  },
  plugins: [],
}
