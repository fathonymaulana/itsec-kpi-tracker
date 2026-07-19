'use client'
import { useEffect } from 'react'
import { DangerTriangleLineDuotone as AlertTriangle, RefreshLineDuotone as RefreshIcon } from '@solar-icons/react-perf'
import { Button } from '@/components/ui/button'

// Wraps every page's content — catches render/effect errors below the root layout (for errors
// thrown by the root layout itself, see app/global-error.tsx instead). Without this file, any
// uncaught client exception fell through to Next's bare "Application error: a client-side
// exception has occurred" page with no way to recover short of a manual reload.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-app flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 size-16 rounded-full bg-danger-soft border border-danger-soft-border flex items-center justify-center">
          <AlertTriangle size={30} className="text-[#CC1F1F]" />
        </div>
        <h1 className="text-xl font-semibold text-ink mb-2">Something went wrong</h1>
        <p className="text-sm text-ink-muted mb-8">
          The app hit an unexpected error. This usually clears up with a retry.
        </p>
        <Button size="lg" onClick={() => reset()}>
          <RefreshIcon size={16} />
          Try again
        </Button>
      </div>
    </div>
  )
}
