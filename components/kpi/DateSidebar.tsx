'use client'
import { useState, useEffect } from 'react'
import {
  AltArrowLeftLineDuotone as ChevronLeft,
  AltArrowRightLineDuotone as ChevronRight,
  CalendarMarkLineDuotone as TodayIcon,
  DoubleAltArrowRightLineDuotone as NextYearIcon,
} from '@solar-icons/react-perf'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { MONTHS } from '@/lib/status'
import { cn } from '@/lib/utils'

export interface MonthPeriod {
  year: number
  month: number
}

interface DateSidebarProps {
  year: number
  onYearChange: (year: number) => void
  month?: number
  onMonthChange?: (month: number) => void
  minYear?: number
  maxYear?: number
  // Range mode (CorPlan's board dashboard only) — pass toYear/toMonth (the range's end) + a single
  // onRangeChange instead of onMonthChange. Renders inside this exact same card shell; only the
  // month grid's selection behavior changes, from a single click to a click-start/click-end range
  // pick. year/onYearChange still drive the header's year arrows, but here they browse which year's
  // grid shows, not the selected value itself — picking a month is what actually commits.
  toYear?: number
  toMonth?: number
  onRangeChange?: (from: MonthPeriod, to: MonthPeriod) => void
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

const periodKey = (p: MonthPeriod) => p.year * 12 + p.month
const periodLabel = (p: MonthPeriod) => `${MONTHS[p.month - 1].slice(0, 3)} ${p.year}`

export function DateSidebar({ year, onYearChange, month, onMonthChange, minYear, maxYear, toYear, toMonth, onRangeChange }: DateSidebarProps) {
  const now = useClock()
  const time = now
    ? now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '--.--'
  const dateLabel = now
    ? now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  const isRange = toYear !== undefined && toMonth !== undefined && !!onRangeChange
  const showMonthGrid = isRange || (month !== undefined && !!onMonthChange)

  const [yearOpen, setYearOpen] = useState(false)
  const [rangeViewYear, setRangeViewYear] = useState(year)
  const [pendingStart, setPendingStart] = useState<MonthPeriod | null>(null)

  const years: number[] = []
  for (let y = minYear ?? year - 5; y <= (maxYear ?? year + 5); y++) years.push(y)

  const from: MonthPeriod = { year, month: month ?? 1 }
  const to: MonthPeriod = { year: toYear ?? year, month: toMonth ?? 1 }
  // Single mode has no separate "browsing" state — its year arrows commit immediately via
  // onYearChange, so the viewed year and the selected year are always the same value. Range mode's
  // arrows only browse (rangeViewYear) until a month is actually clicked.
  const viewYear = isRange ? rangeViewYear : year

  // Resync the browsed year (and clear any half-picked start month) whenever the actual selected
  // range changes from outside — a quick-action commit, a filter elsewhere on the page resetting the
  // range, etc. Without this, browsing to a different year via the arrows and then never picking a
  // month leaves the grid stuck showing that year even after the real selection moves on, so the
  // card visibly disagrees with the data every other part of the page is actually showing. The old
  // popover-wrapped version of this grid got this "reset on reopen" for free from onOpenChange; now
  // that the grid is always visible there's no open event to hook, so this has to watch the props
  // directly instead.
  useEffect(() => {
    setRangeViewYear(year)
    setPendingStart(null)
  }, [year, month, toYear, toMonth])

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

  const outOfBounds = (y: number) => (minYear !== undefined && y < minYear) || (maxYear !== undefined && y > maxYear)

  // Today / Next Month / Next Year below jump straight to that period — in range mode that means
  // collapsing the range to just that one month (same shape as the page's own default range).
  const jumpTo = (y: number, m: number) => {
    if (isRange) {
      onRangeChange?.({ year: y, month: m }, { year: y, month: m })
      setPendingStart(null)
    } else {
      onYearChange(y)
      onMonthChange?.(m)
    }
    setRangeViewYear(y)
  }

  const realNow = new Date()
  const realMonth = realNow.getMonth() + 1
  const realYear = realNow.getFullYear()
  let nextMonthM = realMonth + 1, nextMonthY = realYear
  if (nextMonthM > 12) { nextMonthM = 1; nextMonthY++ }
  const quickActions = [
    { key: 'today', label: 'Today', Icon: TodayIcon, year: realYear, month: realMonth },
    { key: 'next-month', label: 'Next Month', Icon: ChevronRight, year: nextMonthY, month: nextMonthM },
    { key: 'next-year', label: 'Next Year', Icon: NextYearIcon, year: realYear + 1, month: realMonth },
  ]

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Clock */}
      <div className="rounded-3xl bg-gradient-to-br from-[#E8433A] via-[#CC1F1F] to-[#7a1414] flex flex-col items-center justify-center gap-1.5 py-8 px-4 text-center">
        <div className="flex items-baseline gap-1.5 text-white">
          <AnimatedNumber value={time} className="text-5xl font-bold tracking-tight" />
          <span className="text-2xl">WIB</span>
        </div>
        <p className="text-white text-base">{dateLabel}</p>
      </div>

      {/* Year + month grid picker — the day-of-month grid a normal calendar UI would show here is
          replaced by a month grid, since nothing in this app ever filters by exact date, only by
          month/year. */}
      <div className="bg-panel border border-divider rounded-3xl overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <button
            onClick={() => (isRange ? setRangeViewYear(v => v - 1) : onYearChange(year - 1))}
            disabled={minYear !== undefined && viewYear <= minYear}
            className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors disabled:opacity-40 disabled:hover:border-divider"
          >
            <ChevronLeft size={16} className="text-ink" />
          </button>

          {/* Year is always clickable (not just via the arrows either side) — opens a direct-pick
              list, same as the month grid's own single-click behavior. */}
          <Popover open={yearOpen} onOpenChange={setYearOpen}>
            <PopoverTrigger className="text-2xl font-bold text-ink tracking-tight hover:text-[#CC1F1F] transition-colors">
              {viewYear}
            </PopoverTrigger>
            <PopoverContent align="center" className="w-36 p-1.5 max-h-64 overflow-y-auto">
              <div className="flex flex-col gap-0.5">
                {years.map(y => (
                  <button
                    key={y}
                    onClick={() => { if (isRange) setRangeViewYear(y); else onYearChange(y); setYearOpen(false) }}
                    className={cn(
                      'h-9 rounded-md text-sm text-center transition-colors',
                      y === viewYear ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-ink'
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <button
            onClick={() => (isRange ? setRangeViewYear(v => v + 1) : onYearChange(year + 1))}
            disabled={maxYear !== undefined && viewYear >= maxYear}
            className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors disabled:opacity-40 disabled:hover:border-divider"
          >
            <ChevronRight size={16} className="text-ink" />
          </button>
        </div>

        {showMonthGrid && (
          <div className="px-6 pb-5">
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((label, i) => {
                const m = i + 1
                const selected = isRange ? inRange(viewYear, m) : m === month
                const edge = isRange ? isEdge(viewYear, m) : selected
                return (
                  <button
                    key={m}
                    onClick={() => (isRange ? handleRangePick(viewYear, m) : onMonthChange?.(m))}
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
            {isRange && (
              <p className="text-[11px] text-ink-muted mt-2.5 text-center">
                {pendingStart ? `Pick the end month — start: ${periodLabel(pendingStart)}` : 'Pick a start month, then an end month'}
              </p>
            )}
          </div>
        )}

        {/* Quick jumps — Today / Next Month / Next Year, always relative to the real current date,
            not whatever's currently selected (matching how a "Tomorrow"/"Next Week" shortcut would
            behave in a normal day-level date picker). */}
        <div className="px-6 py-2 border-t border-divider flex flex-col">
          {quickActions.map(a => (
            <button
              key={a.key}
              onClick={() => jumpTo(a.year, a.month)}
              disabled={outOfBounds(a.year)}
              className="flex items-center justify-between gap-3 py-2 disabled:opacity-40 disabled:pointer-events-none group"
            >
              <span className="flex items-center gap-3">
                <span className="size-8 rounded-lg bg-ink text-white flex items-center justify-center shrink-0 transition-colors group-hover:bg-[#CC1F1F]">
                  <a.Icon size={15} />
                </span>
                <span className="text-sm font-medium text-ink">{a.label}</span>
              </span>
              <span className="text-sm text-ink-muted">{periodLabel({ year: a.year, month: a.month })}</span>
            </button>
          ))}
        </div>

        {/* Usage hint — this app has no notion of "time of day" (nothing here is scheduled), so the
            row a normal date picker would spend on that instead nudges the user through how the
            picker above actually works. */}
        <div className="px-6 pb-5 pt-3 border-t border-divider">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            {isRange
              ? 'Tap a start month, then an end month, to set the range — every chart, table, and export on this page follows it.'
              : 'Pick a year, then a month — the whole page updates to match.'}
          </p>
        </div>
      </div>
    </div>
  )
}
