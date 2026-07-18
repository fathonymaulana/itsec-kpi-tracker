'use client'
import Link from 'next/link'
import { CompassLineDuotone as Compass, AltArrowLeftLineDuotone as ArrowLeft } from '@solar-icons/react-perf'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { ItsecLogo } from '@/components/layout/ItsecLogo'

const HOME_HREF: Record<string, string> = {
  dept_head: '/dept/dashboard',
  corp_planning: '/board',
}

export default function NotFound() {
  const { user, ready } = useAuth()
  const homeHref = ready && user ? (HOME_HREF[user.role] ?? '/login') : '/login'

  return (
    <div className="min-h-screen bg-app flex flex-col">
      <header className="bg-panel border-b border-divider">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <Link href={homeHref} className="flex items-center gap-2 w-fit">
            <ItsecLogo className="h-4 w-auto text-ink" />
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 size-16 rounded-full bg-danger-soft border border-danger-soft-border flex items-center justify-center">
            <Compass size={30} className="text-[#CC1F1F]" />
          </div>

          <div className="text-6xl font-bold text-ink tracking-[-1.5px]">404</div>
          <h1 className="text-xl font-semibold text-ink mt-3">This page took a wrong turn</h1>
          <p className="text-sm text-ink-muted mt-2 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist, may have moved, or the link might be
            outdated. Nothing to worry about — your data&apos;s exactly where you left it.
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <Button onClick={() => window.history.back()} variant="outline" size="lg">
              <ArrowLeft size={15} className="mr-1.5" />
              Go back
            </Button>
            <Button size="lg" render={<Link href={homeHref}>Back to Dashboard</Link>} />
          </div>
        </div>
      </main>

      <footer className="px-6 pb-8 text-center text-xs text-ink-faint">
        © {new Date().getFullYear()} ITSEC KPI Tracker. All rights reserved.
      </footer>
    </div>
  )
}
