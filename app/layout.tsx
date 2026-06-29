import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

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
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
