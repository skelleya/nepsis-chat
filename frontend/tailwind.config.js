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
          dark: '#1e1f22',
          darker: '#111214',
          channel: '#2b2d31',
          hover: '#35373c',
          accent: '#5865f2',
          'accent-hover': '#4752c4',
          text: '#dbdee1',
          muted: '#b5bac1',
          online: '#23a559',
          offline: '#80848e',
        }
      }
    },
  },
  plugins: [],
}
