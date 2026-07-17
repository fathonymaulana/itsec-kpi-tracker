import { Skeleton } from '@/components/ui/skeleton'

interface PageSkeletonProps {
  leftAside?: boolean
  rightAside?: boolean
}

// Shown in place of the old `if (!ready || !user) return null` blank-screen flash while auth/session
// state resolves — mirrors each page's actual shell (header, optional left/right asides, main content)
// so the swap-in of real content doesn't jump the layout around.
export function PageSkeleton({ leftAside = true, rightAside = true }: PageSkeletonProps) {
  return (
    <div className="h-screen flex flex-col bg-app overflow-hidden">
      <header className="bg-panel shadow-[0_1px_3px_rgba(0,0,0,0.1)] grid grid-cols-3 items-center px-6 h-16 shrink-0">
        <div className="flex items-center justify-self-start">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="flex items-center gap-2 justify-self-center">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="flex items-center gap-2 justify-self-end">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {leftAside && (
          <div className="hidden md:block w-[350px] shrink-0 p-12">
            <div className="flex flex-col gap-4">
              <Skeleton className="rounded-3xl h-[152px] w-full" />
              <Skeleton className="rounded-3xl h-24 w-full" />
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <Skeleton className="h-7 w-56 mb-3" />
            <Skeleton className="h-4 w-full max-w-md mb-8" />
            <div className="flex flex-col gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="rounded-3xl h-28 w-full" />
              ))}
            </div>
          </div>
        </main>

        {rightAside && (
          <div className="hidden lg:block w-[400px] shrink-0 p-8">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="rounded-[10px] h-16 w-full" />
              <Skeleton className="rounded-xl h-14 w-full mt-4" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
