'use client'
import { Badge } from '@/components/ui/badge'
import { getStatusColors, getStatusLabel, type KpiStatus } from '@/lib/status'

interface StatusBadgeProps {
  status: KpiStatus
  size?: 'sm' | 'md'
}

// Built on the shared Badge component (variant="outline" as a neutral base) rather than a raw
// <span> — colors still come from getStatusColors' CSS-var trio via inline style since KpiStatus
// has two values (no_data, review_manually) with no matching Tailwind success/warning/danger token.
export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colors = getStatusColors(status)
  const label = getStatusLabel(status)
  return (
    <Badge
      variant="outline"
      style={{ color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }}
      className={`h-auto font-medium tracking-wide ${
        size === 'sm'
          ? 'px-2 py-0.5 text-[10px] md:text-[11px] rounded'
          : 'px-2.5 py-1 text-[10px] md:text-xs rounded'
      }`}
    >
      {status === 'on_track' && <span className="text-[10px]">●</span>}
      {status === 'watch' && <span className="text-[10px]">◐</span>}
      {status === 'off_track' && <span className="text-[10px]">●</span>}
      {label}
    </Badge>
  )
}
