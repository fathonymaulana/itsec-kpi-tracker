import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'itsec-red':       '#CC1F1F',
        'itsec-dark-red':  '#8B1A1A',
        'itsec-black':     '#1A1A1A',
        'itsec-charcoal':  '#2B2B2B',
        'itsec-grey-1':    '#3D3D3D',
        'itsec-grey-2':    '#595959',
        'itsec-grey-3':    '#808080',
        'itsec-grey-4':    '#AAAAAA',
        'itsec-grey-5':    '#CCCCCC',
        'itsec-grey-6':    '#EBEBEB',
        'itsec-grey-7':    '#F2F2F2',
        'itsec-grey-8':    '#F9F9F9',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        primary: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      screens: {
        sm:    '640px',
        md:    '768px',
        lg:    '1024px',
        xl:    '1280px',
        '2xl': '1536px',
        '3xl': '1920px',
        '4xl': '2560px',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}

export default config
