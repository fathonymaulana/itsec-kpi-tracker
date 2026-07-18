'use client'
import { getStatusColors, getStatusLabel, type KpiStatus } from '@/lib/status'

interface StatusBadgeProps {
  status: KpiStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const colors = getStatusColors(status)
  const label = getStatusLabel(status)
  return (
    <span
      style={{ color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }}
      className={`inline-flex items-center border font-medium tracking-wide ${
        size === 'sm'
          ? 'px-2 py-0.5 text-[10px] md:text-[11px] rounded'
          : 'px-2.5 py-1 text-[10px] md:text-xs rounded'
      }`}
    >
      {status === 'on_track' && <span className="mr-1 text-[10px]">●</span>}
      {status === 'watch' && <span className="mr-1 text-[10px]">◐</span>}
      {status === 'off_track' && <span className="mr-1 text-[10px]">●</span>}
      {label}
    </span>
  )
}
