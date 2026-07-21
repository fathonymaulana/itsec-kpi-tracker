'use client'
import { getStatusColors, MONTHS, type KpiStatus } from '@/lib/status'

interface MonthGridProps {
  data: Partial<Record<number, KpiStatus>>
  compact?: boolean
  // Restrict which months render, in the given order — used when the caller's data only covers a
  // selected range rather than the full Jan-Dec year. Defaults to all 12, in calendar order.
  months?: number[]
}

export function MonthGrid({ data, compact = false, months }: MonthGridProps) {
  const list = months ?? MONTHS.map((_, i) => i + 1)
  return (
    <div className="flex gap-1 flex-wrap">
      {list.map(month => {
        const label = MONTHS[month - 1]
        const status = data[month]
        const colors = getStatusColors(status ?? 'no_data')
        return (
          <div
            key={month}
            title={`${label}: ${status || 'no data'}`}
            style={{ backgroundColor: colors.bg, borderColor: colors.border }}
            className={`border rounded text-center font-medium ${
              compact ? 'w-7 h-6 text-[10px]' : 'w-9 h-8 text-xs'
            } flex items-center justify-center`}
          >
            <span style={{ color: colors.text }}>{label.slice(0, 1)}</span>
          </div>
        )
      })}
    </div>
  )
}
