'use client'
import { AreaChart, Area } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { StatusBadge } from '@/components/kpi/StatusBadge'
import type { KpiStatus } from '@/lib/status'

// var(--foreground), not a literal hex — a fixed color would stay black in dark mode too, going
// nearly invisible against a dark panel.
const CHART_COLOR = 'var(--foreground)'

export function formatKpiValue(v: number | null, unit: string): string {
  if (v === null) return '—'
  if (unit === '%') return `${(v * 100).toFixed(1)}%`
  if (unit === 'x') return `${v.toFixed(2)}×`
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export interface KpiSparklineItem {
  id: number
  name: string
  unit: string
  monthValues: { month: string; value: number | null; status?: KpiStatus }[]
  hasData: boolean
  currentV: number | null
}

// Small-multiples grid of compact trend sparklines, one per KPI, each on its own scale — every
// metric's own target/unit differs too much to plot on a shared numeric axis (a "2x ROAS" and a
// "30% SoV" aren't directly comparable), so this is a grid of independent mini-charts rather than
// one combined chart. Line/area reads trends over time far better than a bar chart would here —
// bars suit comparing discrete categories, not a metric's shape across months. Originally built for
// the dept_head's own dashboard; reused as-is for Corporate Planning's per-department drill-down on
// the board page so both sides of the same data get the same at-a-glance trend view instead of
// CorPlan only ever seeing status categories with no shape behind them.
export function KpiSparklineGrid({ items }: { items: KpiSparklineItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map(({ id, name, unit, monthValues, hasData, currentV }) => {
        const miniConfig: ChartConfig = { value: { label: name, color: CHART_COLOR } }
        return (
          <div key={id} className="bg-panel-soft border border-divider rounded-2xl p-3 min-w-0">
            {/* Name as a small label above a bold headline number, not side-by-side as equally-
                weighted text — the number is the actual visual anchor, the sparkline underneath is
                supporting context. */}
            <div className="text-xs font-medium text-ink-muted truncate mb-0.5">{name}</div>
            {currentV !== null && (
              <div className="text-xl font-semibold text-ink tracking-tight leading-tight mb-1">{formatKpiValue(currentV, unit)}</div>
            )}
            {hasData ? (
              <ChartContainer config={miniConfig} className="h-[64px] w-full aspect-auto">
                <AreaChart data={monthValues} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`sparkline-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        // Status only shows up here, on hover — not as a permanent badge on the card
                        // itself, which would just be re-stating the same on/off-track verdict the
                        // Table tab's KPI Breakdown already carries in text form right below this.
                        formatter={(value, _name, _item, _index, payload) => {
                          const status = (payload as { status?: KpiStatus } | undefined)?.status
                          return [
                            unit === '%' ? `${value}%` : `${value}`,
                            name,
                            status ? <StatusBadge key="status" status={status} size="sm" /> : null,
                          ]
                        }}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={CHART_COLOR}
                    strokeWidth={1.5}
                    fill={`url(#sparkline-grad-${id})`}
                    connectNulls={false}
                    dot={false}
                    activeDot={{ r: 2.5, fill: CHART_COLOR }}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="h-[64px] flex items-center justify-center text-[10px] text-ink-faint">No data yet</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
