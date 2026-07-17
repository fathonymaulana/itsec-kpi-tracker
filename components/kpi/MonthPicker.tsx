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

interface MonthPickerProps {
  year: number
  month: number
  onChange: (year: number, month: number) => void
  minYear?: number
  maxYear?: number
  className?: string
}

// A shadcn-styled month-only picker — deliberately not react-day-picker's day-grid Calendar, since
// every date in this app is a month/year period, not a specific day. Popover + Button trigger follows
// the same shell as shadcn's documented date picker pattern.
export function MonthPicker({ year, month, onChange, minYear, maxYear, className }: MonthPickerProps) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(year)

  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (o) setViewYear(year) }}>
      <PopoverTrigger
        className={cn(buttonVariants({ variant: 'outline' }), 'justify-start text-left font-normal gap-2 border-divider bg-panel text-ink', className)}
      >
        <CalendarIcon size={15} />
        {MONTHS[month - 1]} {year}
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
          {MONTHS.map((label, i) => {
            const m = i + 1
            const isSelected = viewYear === year && m === month
            return (
              <button
                key={m}
                onClick={() => { onChange(viewYear, m); setOpen(false) }}
                className={cn(
                  'h-9 rounded-md text-sm transition-colors',
                  isSelected ? 'bg-primary text-primary-foreground font-medium' : 'hover:bg-muted text-ink'
                )}
              >
                {label.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
