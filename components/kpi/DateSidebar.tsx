'use client'
import { useState, useEffect } from 'react'
import { AltArrowLeftLineDuotone as ChevronLeft, AltArrowRightLineDuotone as ChevronRight } from '@solar-icons/react-perf'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MONTHS } from '@/lib/status'
import { cn } from '@/lib/utils'

interface DateSidebarProps {
  year: number
  onYearChange: (year: number) => void
  month?: number
  onMonthChange?: (month: number) => void
  minYear?: number
  maxYear?: number
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

export function DateSidebar({ year, onYearChange, month, onMonthChange, minYear, maxYear }: DateSidebarProps) {
  const now = useClock()
  const time = now
    ? now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : '--.--'
  const dateLabel = now
    ? now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  const [yearOpen, setYearOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)

  const years: number[] = []
  for (let y = minYear ?? year - 5; y <= (maxYear ?? year + 5); y++) years.push(y)

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Clock */}
      <div className="rounded-3xl bg-gradient-to-br from-[#E8433A] via-[#CC1F1F] to-[#7a1414] flex flex-col items-center justify-center gap-1.5 py-8 px-4 text-center">
        <div className="flex items-baseline gap-1.5 text-white">
          <span className="text-5xl font-bold tracking-tight">{time}</span>
          <span className="text-2xl">WIB</span>
        </div>
        <p className="text-white text-base">{dateLabel}</p>
      </div>

      {/* Year / month picker — arrows step ±1, the label itself opens a direct-pick dropdown */}
      <div className="bg-panel border border-divider rounded-3xl overflow-hidden">
        <div className="bg-panel-soft p-6 flex items-center justify-between">
          <button
            onClick={() => onYearChange(year - 1)}
            disabled={minYear !== undefined && year <= minYear}
            className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors disabled:opacity-40 disabled:hover:border-divider"
          >
            <ChevronLeft size={16} className="text-ink" />
          </button>

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

          <button
            onClick={() => onYearChange(year + 1)}
            disabled={maxYear !== undefined && year >= maxYear}
            className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors disabled:opacity-40 disabled:hover:border-divider"
          >
            <ChevronRight size={16} className="text-ink" />
          </button>
        </div>

        {month !== undefined && onMonthChange && (
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
