/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        board: '#10151a',
        boardLine: '#232c33',
        paper: '#eef1ee',
        signal: '#f0a838',
        teal: '#4fb8ac',
        coral: '#e8615a',
        mute: '#7c8790'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace']
      }
    }
  },
  plugins: []
};
