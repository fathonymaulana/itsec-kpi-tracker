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
  addVariant('data-placeholder', ['&[data-placeholder="true"]', '&[data-placeholder]:not([data-placeholder="false"])'])
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
    // iconHoverClass (lib/utils.ts) is a class-string constant, not a literal in a component file —
    // Tailwind's JIT only extracts candidates from files matched here, so without this glob its
    // classes (including animate-icon-pop below) never made it into the compiled CSS at all.
    './lib/**/*.{js,ts,jsx,tsx}',
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
        popover: { DEFAULT: 'var(--popover)', foreground: 'var(--popover-foreground)' },
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
      // Every `text-*` utility in the scale becomes fluid (clamp between a small-viewport floor and
      // a large-viewport ceiling, scaling with 100vw in between) instead of a fixed px/rem value —
      // this makes the entire app's typography respond to viewport size with zero per-component
      // changes, since every existing `text-sm`/`text-2xl`/etc. class already resolves through this
      // scale. Line-heights are carried over unchanged from Tailwind's own defaults. Deliberately
      // hand-tuned arbitrary sizes (e.g. `text-[12.8px]` on dense table headers) bypass this scale
      // entirely and are left fixed on purpose — that's compact UI chrome, not reading content.
      fontSize: {
        xs:   ['clamp(0.75rem, 0.734rem + 0.08vw, 0.8125rem)', { lineHeight: '1rem' }],
        sm:   ['clamp(0.8125rem, 0.796rem + 0.08vw, 0.875rem)', { lineHeight: '1.25rem' }],
        base: ['clamp(0.9375rem, 0.921rem + 0.08vw, 1rem)', { lineHeight: '1.5rem' }],
        lg:   ['clamp(1rem, 0.967rem + 0.16vw, 1.125rem)', { lineHeight: '1.75rem' }],
        xl:   ['clamp(1.0625rem, 1.013rem + 0.25vw, 1.25rem)', { lineHeight: '1.75rem' }],
        '2xl': ['clamp(1.25rem, 1.184rem + 0.33vw, 1.5rem)', { lineHeight: '2rem' }],
        '3xl': ['clamp(1.5rem, 1.401rem + 0.49vw, 1.875rem)', { lineHeight: '2.25rem' }],
        '4xl': ['clamp(1.75rem, 1.618rem + 0.66vw, 2.25rem)', { lineHeight: '2.5rem' }],
        '5xl': ['clamp(2.125rem, 1.895rem + 1.15vw, 3rem)', { lineHeight: '1' }],
        '6xl': ['clamp(2.5rem, 2.171rem + 1.64vw, 3.75rem)', { lineHeight: '1' }],
        '7xl': ['clamp(3rem, 2.605rem + 1.97vw, 4.5rem)', { lineHeight: '1' }],
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
        // Fluid like the fontSize scale above — rounded-3xl/2xl are the dominant "big card" radius
        // for dashboard/matrix/data-review/verification/modify-request containers app-wide, and on
        // narrow phone screens the full 24px/16px corners eat into already-tight card padding. Caps
        // at the original fixed values, so desktop is pixel-identical to before this change.
        '2xl': 'clamp(0.75rem, 0.684rem + 0.33vw, 1rem)',
        '3xl': 'clamp(1rem, 0.868rem + 0.66vw, 1.5rem)',
      },
      boxShadow: {
        // Tailwind v3 has no "xs" shadow size by default — this matches v4's own --shadow-xs value.
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
      keyframes: {
        // A stand-in for true Lottie shape-morphing (not achievable by transforming a static SVG) —
        // an elastic overshoot-and-settle "pop" that reads as a more alive, designed micro-interaction
        // than a flat hover scale. Ends back at neutral so it composes cleanly with repeated triggers.
        'icon-pop': {
          '0%':   { transform: 'scale(1) rotate(0deg)' },
          '30%':  { transform: 'scale(1.22) rotate(-12deg)' },
          '55%':  { transform: 'scale(0.92) rotate(8deg)' },
          '75%':  { transform: 'scale(1.08) rotate(-4deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
      },
      animation: {
        'icon-pop': 'icon-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) 1',
      },
    },
  },
  plugins: [dataAttributeVariants, animate],
}

export default config
