'use client'
import { getStatusColors, MONTHS, type KpiStatus } from '@/lib/status'

interface MonthGridProps {
  data: Partial<Record<number, KpiStatus>>
  compact?: boolean
}

export function MonthGrid({ data, compact = false }: MonthGridProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {MONTHS.map((label, i) => {
        const month = i + 1
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
