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

interface MobileDatePickerProps {
  year: number
  onYearChange: (year: number) => void
  month?: number
  onMonthChange?: (month: number) => void
  minYear?: number
  maxYear?: number
  className?: string
}

// DateSidebar (the full clock + year/month picker card) is `hidden md:block` — on small screens
// there was previously no way at all to change the period being viewed. This is the small-screen
// stand-in: a single compact trigger showing the current period, placed right under the page header
// (the first thing a mobile user's thumb reaches, and the most contextually obvious spot to look for
// "what period am I looking at, and how do I change it") rather than buried in a side panel toggle.
export function MobileDatePicker({ year, onYearChange, month, onMonthChange, minYear, maxYear, className }: MobileDatePickerProps) {
  const [open, setOpen] = useState(false)
  const years: number[] = []
  for (let y = minYear ?? year - 5; y <= (maxYear ?? year + 5); y++) years.push(y)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex md:hidden items-center gap-1.5 h-10 px-3.5 rounded-lg border border-divider bg-panel text-sm font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] w-fit',
          className
        )}
      >
        <CalendarIcon size={15} className="text-ink-faint" />
        {month !== undefined ? `${MONTHS[month - 1].slice(0, 3)} ${year}` : year}
        <ChevronDown size={13} className="text-ink-faint" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => onYearChange(year - 1)}
            disabled={minYear !== undefined && year <= minYear}
            className="size-7 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={14} className="text-ink" />
          </button>
          <span className="text-sm font-semibold text-ink">{year}</span>
          <button
            onClick={() => onYearChange(year + 1)}
            disabled={maxYear !== undefined && year >= maxYear}
            className="size-7 rounded-md hover:bg-muted flex items-center justify-center disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={14} className="text-ink" />
          </button>
        </div>
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
      </PopoverContent>
    </Popover>
  )
}
