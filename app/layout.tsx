import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth'
import { CookieConsent } from '@/components/layout/CookieConsent'

export const metadata: Metadata = {
  title: 'ITSEC KPI Tracker',
  description: 'Internal KPI tracking dashboard for ITSEC Asia',
  icons: {
    icon: [
      { url: '/favicon-light.ico', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.ico', media: '(prefers-color-scheme: dark)' },
      // Fallback for browsers that don't support prefers-color-scheme on <link rel="icon">.
      { url: '/favicon-light.ico' },
    ],
  },
}

// theme-color tints mobile browser chrome (Safari's status bar/toolbar, Chrome's address bar) with
// a solid color instead of it sampling whatever's at the top of the page — this only has a visible
// effect on small/mobile screens, desktop browsers ignore it. Matches --destructive exactly (red-600
// light / red-400 dark), not the separate brand red (#CC1F1F) used for CTAs elsewhere in the app.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#dc2626' },
    { media: '(prefers-color-scheme: dark)', color: '#f87171' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      {/* bg-app/text-ink (not the old bg-itsec-grey-8/text-itsec-black) — those were fixed hex
          swatches that never responded to the .dark class, so any content relying on inherited
          body color/background (rather than its own explicit override) stayed light-themed
          everywhere in dark mode. */}
      <body className="font-sans bg-app text-ink antialiased">
        <AuthProvider>
          {children}
          <CookieConsent />
        </AuthProvider>
        <Toaster position="bottom-right" visibleToasts={4} />
      </body>
    </html>
  )
}
