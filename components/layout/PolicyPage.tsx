import Link from 'next/link'
import { ItsecLogo } from '@/components/layout/ItsecLogo'

interface PolicyPageProps {
  title: string
  updated: string
  children: React.ReactNode
}

export function PolicyPage({ title, updated, children }: PolicyPageProps) {
  return (
    <div className="min-h-screen bg-app">
      <header className="bg-panel border-b border-divider">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2">
            <ItsecLogo className="h-4 w-auto text-ink" />
          </Link>
          <Link href="/login" className="text-sm text-ink-muted hover:text-ink transition-colors">
            Back to Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
        <h1 className="text-ink text-3xl md:text-[40px] font-semibold tracking-[-0.5px] leading-tight">
          {title}
        </h1>
        <p className="text-ink-faint text-sm mt-2">Last updated {updated}</p>

        <div className="mt-10 flex flex-col gap-8 text-ink-soft text-[15px] leading-7 [&_h2]:text-ink [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-[-0.2px] [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_strong]:text-ink [&_strong]:font-medium [&_a]:text-[#CC1F1F] [&_a]:hover:underline">
          {children}
        </div>
      </main>

      <footer className="max-w-3xl mx-auto px-6 pb-12 text-xs text-ink-faint">
        © {new Date().getFullYear()} ITSEC KPI Tracker. All rights reserved.
      </footer>
    </div>
  )
}
