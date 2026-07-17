'use client'
import { useState, useEffect } from 'react'
import { AltArrowLeftLineDuotone as ChevronLeft, AltArrowRightLineDuotone as ChevronRight } from '@solar-icons/react-perf'
import { MonthPicker } from './MonthPicker'

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

      {/* Year / month picker */}
      {month !== undefined && onMonthChange ? (
        <div className="bg-panel border border-divider rounded-3xl p-4">
          <MonthPicker
            year={year}
            month={month}
            onChange={(y, m) => { if (y !== year) onYearChange(y); onMonthChange(m) }}
            minYear={minYear}
            maxYear={maxYear}
            className="w-full"
          />
        </div>
      ) : (
        <div className="bg-panel border border-divider rounded-3xl overflow-hidden">
          <div className="bg-panel-soft p-6 flex items-center justify-between">
            <button
              onClick={() => onYearChange(year - 1)}
              disabled={minYear !== undefined && year <= minYear}
              className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors disabled:opacity-40 disabled:hover:border-divider"
            >
              <ChevronLeft size={16} className="text-ink" />
            </button>
            <span className="text-xl font-semibold text-ink tracking-[-0.1px]">{year}</span>
            <button
              onClick={() => onYearChange(year + 1)}
              disabled={maxYear !== undefined && year >= maxYear}
              className="size-8 rounded-lg bg-panel border border-divider flex items-center justify-center hover:border-[#CC1F1F] transition-colors disabled:opacity-40 disabled:hover:border-divider"
            >
              <ChevronRight size={16} className="text-ink" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
