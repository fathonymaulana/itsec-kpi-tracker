import type { Config } from "tailwindcss"
import plugin from "tailwindcss/plugin"
import animate from "tailwindcss-animate"

// The shadcn components in this project were generated against Tailwind v4's CSS-first
// `@custom-variant` syntax (see node_modules/shadcn/dist/tailwind.css, imported from
// app/globals.css) — but this project runs Tailwind v3, which doesn't understand
// `@custom-variant`/`@slot` at all, so PostCSS silently drops those blocks and every
// `data-open:`/`data-active:`/`data-horizontal:` etc. class in dialog.tsx, tabs.tsx,
// select.tsx, switch.tsx, checkbox.tsx, and popover.tsx compiled to nothing. Re-registering
// the same variants here via v3's `addVariant` API (matching the exact selectors from that
// v4 CSS) is far lower-risk than upgrading the whole project to Tailwind v4 mid-session.
const dataAttributeVariants = plugin(({ addVariant }) => {
  addVariant('data-open', ['&[data-state="open"]', '&[data-open]:not([data-open="false"])'])
  addVariant('data-closed', ['&[data-state="closed"]', '&[data-closed]:not([data-closed="false"])'])
  addVariant('data-checked', ['&[data-state="checked"]', '&[data-checked]:not([data-checked="false"])'])
  addVariant('data-unchecked', ['&[data-state="unchecked"]', '&[data-unchecked]:not([data-unchecked="false"])'])
  addVariant('data-selected', '&[data-selected="true"]')
  addVariant('data-disabled', ['&[data-disabled="true"]', '&[data-disabled]:not([data-disabled="false"])'])
  addVariant('data-active', ['&[data-state="active"]', '&[data-active]:not([data-active="false"])'])
  addVariant('data-horizontal', '&[data-orientation="horizontal"]')
  addVariant('data-vertical', '&[data-orientation="vertical"]')
  // Grouped forms (group-data-horizontal/tabs:h-8 etc.) — the only named group these appear
  // on in this codebase is `group/tabs` (components/ui/tabs.tsx), so the group class is
  // hardcoded here rather than reimplementing Tailwind's generic `/name` modifier resolution.
  addVariant('group-data-horizontal', '.group\\/tabs[data-orientation="horizontal"] &')
  addVariant('group-data-vertical', '.group\\/tabs[data-orientation="vertical"] &')
})

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
        app: 'var(--app-bg)',
        panel: { DEFAULT: 'var(--panel-bg)', soft: 'var(--panel-soft-bg)' },
        divider: 'var(--divider)',
        ink: { DEFAULT: 'var(--ink)', soft: 'var(--ink-soft)', muted: 'var(--ink-muted)', faint: 'var(--ink-faint)' },
        success: { DEFAULT: 'var(--success-text)', soft: 'var(--success-soft-bg)', 'soft-border': 'var(--success-soft-border)' },
        danger: { DEFAULT: 'var(--danger-text)', soft: 'var(--danger-soft-bg)', 'soft-border': 'var(--danger-soft-border)' },
        warning: { DEFAULT: 'var(--warning-text)', soft: 'var(--warning-soft-bg)', 'soft-border': 'var(--warning-soft-border)' },
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
  plugins: [dataAttributeVariants, animate],
}

export default config
