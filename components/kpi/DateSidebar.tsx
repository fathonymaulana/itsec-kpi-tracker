'use client'
import { useState, useEffect } from 'react'
import { AltArrowLeftLineDuotone as ChevronLeft, AltArrowRightLineDuotone as ChevronRight } from '@solar-icons/react-perf'
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
  // onRangeChange instead of onMonthChange. Renders inside this exact same clock + card shell; only
  // the month row's contents change, from prev/next-by-one-month arrows to a click-start/click-end
  // range popover (same two-click convention as the old standalone MonthRangePicker this replaces) —
  // "step by one month" doesn't have a clean meaning for a two-ended range. year/onYearChange still
  // drive the header's year arrows, but here they browse which year's grid the popover shows, not
  // the selected value itself — the popover always resets that browsing year to `year` when opened.
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

  const [yearOpen, setYearOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  const [rangeViewYear, setRangeViewYear] = useState(year)
  const [pendingStart, setPendingStart] = useState<MonthPeriod | null>(null)

  const years: number[] = []
  for (let y = minYear ?? year - 5; y <= (maxYear ?? year + 5); y++) years.push(y)

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
    setMonthOpen(false)
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
    <div className="flex flex-col gap-4 w-full">
      {/* Clock */}
      <div className="rounded-3xl bg-gradient-to-br from-[#E8433A] via-[#CC1F1F] to-[#7a1414] flex flex-col items-center justify-center gap-1.5 py-8 px-4 text-center">
        <div className="flex items-baseline gap-1.5 text-white">
          <AnimatedNumber value={time} className="text-5xl font-bold tracking-tight" />
          <span className="text-2xl">WIB</span>
        </div>
        <p className="text-white text-base">{dateLabel}</p>
      </div>

      {/* Year / month picker — arrows step ±1, the label itself opens a direct-pick dropdown */}
      <div className="bg-panel border border-divider rounded-3xl overflow-hidden">
        <div className="bg-panel-soft p-6 flex items-center justify-between">
          <button
            onClick={() => (isRange ? setRangeViewYear(v => v - 1) : onYearChange(year - 1))}
            disabled={minYear !== undefined && (isRange ? rangeViewYear : year) <= minYear}
            className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors disabled:opacity-40 disabled:hover:border-divider"
          >
            <ChevronLeft size={16} className="text-ink" />
          </button>

          {isRange ? (
            <span className="text-xl font-semibold text-ink tracking-[-0.1px]">{rangeViewYear}</span>
          ) : (
            <Popover open={yearOpen} onOpenChange={setYearOpen}>
              <PopoverTrigger className="text-xl font-semibold text-ink tracking-[-0.1px] hover:text-[#CC1F1F] transition-colors">
                {year}
              </PopoverTrigger>
              <PopoverContent align="center" className="w-36 p-1.5 max-h-64 overflow-y-auto">
                <div className="flex flex-col gap-0.5">
                  {years.map(y => (
                    <button
                      key={y}
                      onClick={() => { onYearChange(y); setYearOpen(false) }}
                      className={cn(
                        'h-9 rounded-md text-sm text-center transition-colors',
                        y === year ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-ink'
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <button
            onClick={() => (isRange ? setRangeViewYear(v => v + 1) : onYearChange(year + 1))}
            disabled={maxYear !== undefined && (isRange ? rangeViewYear : year) >= maxYear}
            className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors disabled:opacity-40 disabled:hover:border-divider"
          >
            <ChevronRight size={16} className="text-ink" />
          </button>
        </div>

        {isRange ? (
          <div className="px-6 py-4">
            <Popover
              open={monthOpen}
              onOpenChange={o => { setMonthOpen(o); if (o) { setRangeViewYear(year); setPendingStart(null) } }}
            >
              <PopoverTrigger className="w-full text-center text-base font-medium text-ink tracking-[-0.192px] hover:text-[#CC1F1F] transition-colors">
                {periodLabel(from)} – {periodLabel(to)}
              </PopoverTrigger>
              <PopoverContent align="center" className="w-56 p-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTHS.map((label, i) => {
                    const m = i + 1
                    const selected = inRange(rangeViewYear, m)
                    const edge = isEdge(rangeViewYear, m)
                    return (
                      <button
                        key={m}
                        onClick={() => handleRangePick(rangeViewYear, m)}
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
              </PopoverContent>
            </Popover>
          </div>
        ) : month !== undefined && onMonthChange && (
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => onMonthChange(month === 1 ? 12 : month - 1)}
                className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors"
              >
                <ChevronLeft size={16} className="text-ink" />
              </button>

              <Popover open={monthOpen} onOpenChange={setMonthOpen}>
                <PopoverTrigger className="text-base font-medium text-ink tracking-[-0.192px] hover:text-[#CC1F1F] transition-colors">
                  {MONTHS[month - 1]}
                </PopoverTrigger>
                <PopoverContent align="center" className="w-56 p-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {MONTHS.map((label, i) => {
                      const m = i + 1
                      return (
                        <button
                          key={m}
                          onClick={() => { onMonthChange(m); setMonthOpen(false) }}
                          className={cn(
                            'h-9 rounded-md text-sm transition-colors',
                            m === month ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-ink'
                          )}
                        >
                          {label.slice(0, 3)}
                        </button>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <button
                onClick={() => onMonthChange(month === 12 ? 1 : month + 1)}
                className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors"
              >
                <ChevronRight size={16} className="text-ink" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
