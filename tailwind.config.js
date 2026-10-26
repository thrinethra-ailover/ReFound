/** @type {import('tailwindcss').Config} */
export default {
  // This generated 570 KB vocabulary dataset contains no UI classes; exclude it
  // from Tailwind's source scanner so production CSS builds stay fast.
  content: ['./index.html', './src/**/*.{ts,tsx}', '!./src/lib/matching/openEnglishWordnetSynsets.ts'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#101826', soft: '#1B2436' },
        paper: '#FAF8F3',
        surface: '#FFFFFF',
        signal: { DEFAULT: '#1F8A82', dark: '#166E67' },
        beacon: { DEFAULT: '#F2A93B', dark: '#C6841F' },
        coral: { DEFAULT: '#E2574C', dark: '#BE4139' },
        slate: { DEFAULT: '#5B6472', light: '#8B93A0' },
        border: '#E4E0D6',
      },
      fontFamily: {
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 38, 0.04), 0 4px 16px rgba(16, 24, 38, 0.06)',
        'card-hover': '0 2px 4px rgba(16, 24, 38, 0.06), 0 8px 24px rgba(16, 24, 38, 0.10)',
      },
    },
  },
  plugins: [],
};
