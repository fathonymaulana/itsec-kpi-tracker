import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/lib/auth'
import { CookieConsent } from '@/components/layout/CookieConsent'

export const metadata: Metadata = {
  title: 'ITSEC KPI Tracker',
  description: 'Internal KPI tracking dashboard for ITSEC Asia',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans bg-itsec-grey-8 text-itsec-black antialiased">
        <AuthProvider>
          {children}
          <CookieConsent />
        </AuthProvider>
        <Toaster richColors position="bottom-right" visibleToasts={4} />
      </body>
    </html>
  )
}
