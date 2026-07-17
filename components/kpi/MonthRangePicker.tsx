'use client'
import { useState } from 'react'
import {
  AltArrowLeftLineDuotone as ChevronLeft,
  AltArrowRightLineDuotone as ChevronRight,
  CalendarLineDuotone as CalendarIcon,
} from '@solar-icons/react-perf'
import { buttonVariants } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MONTHS } from '@/lib/status'
import { cn } from '@/lib/utils'

export interface MonthPeriod {
  year: number
  month: number
}

interface MonthRangePickerProps {
  from: MonthPeriod
  to: MonthPeriod
  onChange: (from: MonthPeriod, to: MonthPeriod) => void
  minYear?: number
  maxYear?: number
  className?: string
}

const key = (p: MonthPeriod) => p.year * 12 + p.month
const label = (p: MonthPeriod) => `${MONTHS[p.month - 1].slice(0, 3)} ${p.year}`

// Same shell as MonthPicker, but click-once-for-start / click-again-for-end, matching the two-click
// range-selection convention of shadcn's day-range Calendar — just at month granularity, since every
// period in this app is a month/year, not a specific day.
export function MonthRangePicker({ from, to, onChange, minYear, maxYear, className }: MonthRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(from.year)
  const [pendingStart, setPendingStart] = useState<MonthPeriod | null>(null)

  const handlePick = (year: number, month: number) => {
    const picked = { year, month }
    if (!pendingStart) {
      setPendingStart(picked)
      return
    }
    const a = key(pendingStart)
    const b = key(picked)
    const [newFrom, newTo] = a <= b ? [pendingStart, picked] : [picked, pendingStart]
    onChange(newFrom, newTo)
    setPendingStart(null)
    setOpen(false)
  }

  const inRange = (year: number, month: number) => {
    const k = year * 12 + month
    if (pendingStart) return key(pendingStart) === k
    return k >= key(from) && k <= key(to)
  }
  const isEdge = (year: number, month: number) => {
    const k = year * 12 + month
    return !pendingStart && (k === key(from) || k === key(to))
  }

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) { setViewYear(from.year); setPendingStart(null) } }}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline' }), 'justify-start text-left font-normal gap-2 border-divider bg-panel text-ink', className)}
      >
        <CalendarIcon size={15} />
        {label(from)} – {label(to)}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setViewYear(y => y - 1)}
            disabled={minYear !== undefined && viewYear <= minYear}
            className="size-7 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={14} className="text-ink" />
          </button>
          <span className="text-sm font-medium text-ink">{viewYear}</span>
          <button
            onClick={() => setViewYear(y => y + 1)}
            disabled={maxYear !== undefined && viewYear >= maxYear}
            className="size-7 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={14} className="text-ink" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((m, i) => {
            const monthNum = i + 1
            const selected = inRange(viewYear, monthNum)
            const edge = isEdge(viewYear, monthNum)
            return (
              <button
                key={monthNum}
                onClick={() => handlePick(viewYear, monthNum)}
                className={cn(
                  'h-9 rounded-md text-sm transition-colors',
                  edge ? 'bg-primary text-primary-foreground font-medium'
                    : selected ? 'bg-muted text-ink'
                    : 'hover:bg-muted text-ink'
                )}
              >
                {m.slice(0, 3)}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-ink-muted mt-3 text-center">
          {pendingStart ? `Pick the end month — start: ${label(pendingStart)}` : 'Pick a start month, then an end month'}
        </p>
      </PopoverContent>
    </Popover>
  )
}
