'use client'
import { useState } from 'react'
import {
  CalendarLineDuotone as CalendarIcon,
  AltArrowDownLineDuotone as ChevronDown,
  AltArrowLeftLineDuotone as ChevronLeft,
  AltArrowRightLineDuotone as ChevronRight,
} from '@solar-icons/react-perf'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MONTHS } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { MonthPeriod } from '@/components/kpi/DateSidebar'

interface MobileDatePickerProps {
  year: number
  onYearChange: (year: number) => void
  month?: number
  onMonthChange?: (month: number) => void
  minYear?: number
  maxYear?: number
  className?: string
  // Range mode — mirrors DateSidebar's: pass toYear/toMonth + onRangeChange instead of onMonthChange.
  toYear?: number
  toMonth?: number
  onRangeChange?: (from: MonthPeriod, to: MonthPeriod) => void
}

const periodKey = (p: MonthPeriod) => p.year * 12 + p.month
const periodLabel = (p: MonthPeriod) => `${MONTHS[p.month - 1].slice(0, 3)} ${p.year}`

// DateSidebar (the full clock + year/month picker card) is `hidden md:block` — on small screens
// there was previously no way at all to change the period being viewed. This is the small-screen
// stand-in: a single compact trigger showing the current period, placed right under the page header
// (the first thing a mobile user's thumb reaches, and the most contextually obvious spot to look for
// "what period am I looking at, and how do I change it") rather than buried in a side panel toggle.
export function MobileDatePicker({ year, onYearChange, month, onMonthChange, minYear, maxYear, className, toYear, toMonth, onRangeChange }: MobileDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(year)
  const [pendingStart, setPendingStart] = useState<MonthPeriod | null>(null)
  const years: number[] = []
  for (let y = minYear ?? year - 5; y <= (maxYear ?? year + 5); y++) years.push(y)

  const isRange = toYear !== undefined && toMonth !== undefined && !!onRangeChange
  const from: MonthPeriod = { year, month: month ?? 1 }
  const to: MonthPeriod = { year: toYear ?? year, month: toMonth ?? 1 }

  const handleRangePick = (pickYear: number, pickMonth: number) => {
    const picked = { year: pickYear, month: pickMonth }
    if (!pendingStart) {
      setPendingStart(picked)
      return
    }
    const a = periodKey(pendingStart)
    const b = periodKey(picked)
    const [newFrom, newTo] = a <= b ? [pendingStart, picked] : [picked, pendingStart]
    onRangeChange?.(newFrom, newTo)
    setPendingStart(null)
    setOpen(false)
  }
  const inRange = (y: number, m: number) => {
    const k = y * 12 + m
    if (pendingStart) return periodKey(pendingStart) === k
    return k >= periodKey(from) && k <= periodKey(to)
  }
  const isEdge = (y: number, m: number) => {
    const k = y * 12 + m
    return !pendingStart && (k === periodKey(from) || k === periodKey(to))
  }

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o && isRange) { setViewYear(year); setPendingStart(null) } }}>
      <PopoverTrigger
        className={cn(
          'flex md:hidden items-center gap-1.5 h-10 px-3.5 rounded-lg border border-divider bg-panel text-sm font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] w-fit',
          className
        )}
      >
        <CalendarIcon size={15} className="text-ink-faint" />
        {isRange ? `${periodLabel(from)} – ${periodLabel(to)}` : month !== undefined ? `${MONTHS[month - 1].slice(0, 3)} ${year}` : year}
        <ChevronDown size={13} className="text-ink-faint" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => (isRange ? setViewYear(v => v - 1) : onYearChange(year - 1))}
            disabled={minYear !== undefined && (isRange ? viewYear : year) <= minYear}
            className="size-7 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={14} className="text-ink" />
          </button>
          <span className="text-sm font-semibold text-ink">{isRange ? viewYear : year}</span>
          <button
            onClick={() => (isRange ? setViewYear(v => v + 1) : onYearChange(year + 1))}
            disabled={maxYear !== undefined && (isRange ? viewYear : year) >= maxYear}
            className="size-7 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={14} className="text-ink" />
          </button>
        </div>
        {isRange ? (
          <>
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((label, i) => {
                const m = i + 1
                const selected = inRange(viewYear, m)
                const edge = isEdge(viewYear, m)
                return (
                  <button
                    key={m}
                    onClick={() => handleRangePick(viewYear, m)}
                    className={cn(
                      'h-9 rounded-md text-sm transition-colors',
                      edge ? 'bg-primary text-primary-foreground font-medium'
                        : selected ? 'bg-muted text-ink'
                        : 'hover:bg-muted text-ink'
                    )}
                  >
                    {label.slice(0, 3)}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-ink-muted mt-2.5 text-center">
              {pendingStart ? `Pick the end month — start: ${periodLabel(pendingStart)}` : 'Pick a start month, then an end month'}
            </p>
          </>
        ) : (
          <>
            {month === undefined && (
              <div className="max-h-48 overflow-y-auto grid grid-cols-3 gap-1.5">
                {years.map(y => (
                  <button
                    key={y}
                    onClick={() => { onYearChange(y); setOpen(false) }}
                    className={cn('h-9 rounded-md text-sm transition-colors', y === year ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-ink')}
                  >
                    {y}
                  </button>
                ))}
              </div>
            )}
            {month !== undefined && onMonthChange && (
              <div className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((label, i) => {
                  const m = i + 1
                  return (
                    <button
                      key={m}
                      onClick={() => { onMonthChange(m); setOpen(false) }}
                      className={cn('h-9 rounded-md text-sm transition-colors', m === month ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-ink')}
                    >
                      {label.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
