import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'gem-green': '#00ff88',
        'gem-red': '#ff4444',
        'gem-yellow': '#ffcc00',
        'gem-blue': '#00aaff',
        'gem-dark': '#0a0a0f',
        'gem-card': '#12121a',
        'gem-border': '#1f1f2e',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
export default config
