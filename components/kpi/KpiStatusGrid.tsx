'use client'
import type { ComponentType } from 'react'
import { StatusBadge } from '@/components/kpi/StatusBadge'
import { getStatusColors, type KpiStatus } from '@/lib/status'

export function formatKpiValue(v: number | null, unit: string): string {
  if (v === null) return '—'
  if (unit === '%') return `${(v * 100).toFixed(1)}%`
  if (unit === 'x') return `${v.toFixed(2)}×`
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

// Same formatting as formatKpiValue, but with the unit split out — the status cards put the number
// and its unit at different sizes/weights (a big bold value, a smaller muted suffix), which a single
// combined string can't do.
export function formatKpiValueParts(v: number | null, unit: string): { value: string; suffix: string } {
  if (v === null) return { value: '—', suffix: '' }
  if (unit === '%') return { value: (v * 100).toFixed(1), suffix: '%' }
  if (unit === 'x') return { value: v.toFixed(2), suffix: '×' }
  return { value: v.toLocaleString(undefined, { maximumFractionDigits: 1 }), suffix: unit }
}

// "+0.21× vs last month" / "-3.1% vs last month" — deltaRaw is already in the sub-metric's raw scale
// (a 0-1 fraction for '%' units), so it gets the same *100 scaling formatKpiValue applies before
// display. `improving` flips for direction=-1 KPIs (lower is better, e.g. cost/attrition/error-rate
// metrics) — a negative delta there is the good direction.
export function formatKpiDelta(deltaRaw: number | null, unit: string, direction: number): { text: string; improving: boolean } | null {
  if (deltaRaw === null || deltaRaw === 0) return null
  const scaled = unit === '%' ? deltaRaw * 100 : deltaRaw
  const sign = scaled > 0 ? '+' : ''
  const text = unit === '%' ? `${sign}${scaled.toFixed(1)}%`
    : unit === 'x' ? `${sign}${scaled.toFixed(2)}×`
    : `${sign}${scaled.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
  const improving = direction === -1 ? scaled < 0 : scaled > 0
  return { text, improving }
}

export interface KpiStatusItem {
  id: number
  name: string
  unit: string
  currentV: number | null
  currentStatus: KpiStatus
  target: number | null
  direction: number
  pctOfTarget: number | null
  deltaRaw: number | null
}

interface KpiStatusGridProps {
  items: KpiStatusItem[]
  // Passed in rather than imported here since each caller already has its own trend icons in scope
  // (from @solar-icons/react-perf) and this component has no opinion on which exact glyphs to use.
  // size is string | number (not just number) to match Solar Icons' own IconProps exactly.
  TrendUpIcon: ComponentType<{ size?: number | string }>
  TrendDownIcon: ComponentType<{ size?: number | string }>
}

// Grid of per-KPI status cards — status badge, current value, target, a progress-to-target bar, and
// a month-over-month delta, all colored by that KPI's current status. Replaced an earlier small-
// multiples sparkline grid: the full-size trend charts elsewhere on each page still carry the shape-
// over-time job, these are for a faster "who needs attention right now" scan than a dozen sparklines
// require parsing individually. Shared between the dept_head's own dashboard and Corporate Planning's
// per-department drill-down on the board page so both sides read the same at-a-glance status view.
export function KpiStatusGrid({ items, TrendUpIcon, TrendDownIcon }: KpiStatusGridProps) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map(({ id, name, unit, currentV, currentStatus, target, pctOfTarget, deltaRaw, direction }) => {
        const { value, suffix } = formatKpiValueParts(currentV, unit)
        const delta = formatKpiDelta(deltaRaw, unit, direction)
        const colors = getStatusColors(currentStatus)
        const clampedPct = pctOfTarget !== null ? Math.min(100, Math.max(0, pctOfTarget)) : null
        return (
          <div
            key={id}
            className="bg-panel-soft border border-divider border-l-4 rounded-2xl p-4 min-w-0"
            style={{ borderLeftColor: colors.text }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-medium text-ink truncate">{name}</span>
              <StatusBadge status={currentStatus} size="sm" />
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-2xl font-bold text-ink tracking-tight">{value}</span>
              {suffix && <span className="text-sm text-ink-muted">{suffix}</span>}
            </div>
            {target !== null && (
              <div className="text-xs text-ink-muted mb-3">
                Target: {formatKpiValueParts(target, unit).value}{formatKpiValueParts(target, unit).suffix}
              </div>
            )}
            {clampedPct !== null && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-1.5 rounded-full bg-panel overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${clampedPct}%`, backgroundColor: colors.text }} />
                </div>
                <span className="text-xs font-medium shrink-0" style={{ color: colors.text }}>{Math.round(pctOfTarget!)}%</span>
              </div>
            )}
            {delta && (
              <div className="flex items-center gap-1 text-xs font-medium" style={{ color: delta.improving ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {delta.improving ? <TrendUpIcon size={12} /> : <TrendDownIcon size={12} />}
                {delta.text} vs last month
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
