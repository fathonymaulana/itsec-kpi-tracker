import { cn } from '@/lib/utils'

interface EmptyStateProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>
  title: string
  description?: string
  className?: string
  compact?: boolean
  children?: React.ReactNode
}

// Consistent empty-state shape used everywhere a list/table has nothing to show — icon in a soft
// rounded chip, a short title, an optional one-line description explaining why or what to do next,
// and optional children for a follow-up action (e.g. "Clear search"), rather than a lone line of
// muted text.
export function EmptyState({ icon: Icon, title, description, className, compact = false, children }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-12' : 'py-20', className)}>
      <div className="size-12 rounded-2xl bg-panel-soft border border-divider flex items-center justify-center mb-4">
        <Icon size={22} className="text-ink-faint" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="text-xs text-ink-muted mt-1 max-w-xs">{description}</p>}
      {children}
    </div>
  )
}
