'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraphNewUpLinear as TrendingUp,
  EyeLinear as Eye,
  GraphDownNewLinear as TrendingDown,
  MinusCircleLinear as CircleDashed,
} from '@solar-icons/react-perf'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { StatusBadge } from '@/components/kpi/StatusBadge'
import { MonthGrid } from '@/components/kpi/MonthGrid'
import { getStatus, MONTHS, type KpiStatus } from '@/lib/status'
import { getPrimarySubMetric, resolvePrimaryValue } from '@/lib/kpi-primary'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const CURRENT_YEAR = new Date().getFullYear()

interface SubMetric {
  id: number; name: string; unit: string;
  is_calculated: number; formula_key: string | null; calc_input_positions: string | null
  numeric_target: number | null; direction: number | null
}
interface Kpi {
  id: number; name: string; target_text: string; numeric_target: number | null; direction: number
  sub_metrics: SubMetric[]
}

// Status compares against the PRIMARY sub-metric's own target/direction (set per-row, not per-KPI —
// see lib/kpi-primary.ts), matching the logic already used server-side in app/api/board/summary/[year].
// kpi.numeric_target/direction are stale for KPIs with multiple components and must not be used here.
function statusFor(kpi: Kpi, valuesBySmId: Record<number, number>): { value: number | null; status: KpiStatus } {
  const primary = getPrimarySubMetric(kpi.sub_metrics)
  const value = resolvePrimaryValue(kpi.sub_metrics, valuesBySmId)
  const status = getStatus(value, primary?.numeric_target ?? null, primary?.direction ?? 1)
  return { value, status }
}

export default function DeptDashboard() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [year, setYear] = useState(CURRENT_YEAR)
  const [allActuals, setAllActuals] = useState<Record<number, Record<number, number>>>({}) // month → {smId → value}
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'dept_head') { router.push('/board'); return }
  }, [user, router, ready])

  const fetchData = useCallback(async () => {
    if (!user || !token) return
    setLoading(true)
    try {
      const [kpiRes, actRes] = await Promise.all([
        fetch(`/api/departments/${user.dept_id}/kpis`, { headers: authHeaders(token) }),
        fetch(`/api/actuals?dept_id=${user.dept_id}&year=${year}`, { headers: authHeaders(token) }),
      ])
      const kpiData = await kpiRes.json()
      const actData = await actRes.json()
      setKpis(kpiData.kpis || [])
      const byMonth: Record<number, Record<number, number>> = {}
      for (const a of (actData.actuals || [])) {
        if (!byMonth[a.month]) byMonth[a.month] = {}
        byMonth[a.month][a.sub_metric_id] = a.value
      }
      setAllActuals(byMonth)
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [user, token, year])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  // Stats
  const currentMonth = new Date().getMonth() + 1
  const statuses = kpis.map(kpi => {
    const vals = allActuals[currentMonth] || {}
    return statusFor(kpi, vals).status
  })
  const onTrack = statuses.filter(s => s === 'on_track').length
  const watch = statuses.filter(s => s === 'watch').length
  const offTrack = statuses.filter(s => s === 'off_track').length
  const noData = statuses.filter(s => s === 'no_data').length

  if (!ready || !user) return null

  return (
    <div className="h-screen flex flex-col bg-[#fafafa] overflow-hidden">
      <DeptTopNav />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: clock + year picker */}
        <aside className="hidden md:block w-[350px] shrink-0 p-12 overflow-y-auto">
          <DateSidebar year={year} onYearChange={setYear} minYear={CURRENT_YEAR - 1} maxYear={CURRENT_YEAR} />
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-[#282828] tracking-[-0.6px]">Dashboard</h1>
                <p className="text-sm text-[#737373] mt-1 max-w-xl">
                  {kpis.length > 0
                    ? `A month-by-month view of every KPI ${user.dept_name} tracks, so you can spot trends before they become problems.`
                    : 'Once KPIs are configured for your department, their trends will show up here.'}
                </p>
              </div>
              <span className="text-xs text-[#737373] shrink-0 mt-1">{kpis.length} KPIs</span>
            </div>

        {/* Stat summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'On Track', value: onTrack, color: '#0d9488', Icon: TrendingUp, caption: 'performing at or above target' },
            { label: 'Watch', value: watch, color: '#B45309', Icon: Eye, caption: 'trending toward target, worth watching' },
            { label: 'Off Track', value: offTrack, color: '#CC1F1F', Icon: TrendingDown, caption: 'below target — needs attention' },
            { label: 'No Data', value: noData, color: '#737373', Icon: CircleDashed, caption: 'not yet entered this month' },
          ].map(s => {
            const pct = kpis.length > 0 ? Math.round((s.value / kpis.length) * 100) : 0
            return (
              <div key={s.label} className="bg-white border border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-6 flex flex-col gap-1.5">
                <div className="text-sm text-[#737373]">{s.label}</div>
                <div className="text-[40px] leading-[48px] font-medium text-[#282828] tracking-[-0.5px]">{s.value}</div>
                <div className="flex items-center gap-1">
                  <s.Icon size={14} style={{ color: s.color }} />
                  <span className="text-base font-semibold" style={{ color: s.color }}>{pct}%</span>
                  <span className="text-xs text-[#737373]">of {kpis.length || 0}</span>
                </div>
                <div className="text-xs text-[#737373] mt-1">{s.caption}</div>
              </div>
            )
          })}
        </div>

        {/* KPI cards with charts */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-white border border-[#e5e5e5] rounded-3xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {kpis.map(kpi => {
              const monthStatuses: Partial<Record<number, KpiStatus>> = {}
              const chartData = MONTHS.map((label, mi) => {
                const m = mi + 1
                const vals = allActuals[m] || {}
                const { value: v, status } = statusFor(kpi, vals)
                monthStatuses[m] = status
                const primaryCalcSm = kpi.sub_metrics.find(sm => sm.is_calculated)
                const unit = primaryCalcSm?.unit || kpi.sub_metrics[0]?.unit || ''
                const displayValue = v !== null
                  ? unit === '%' ? parseFloat((v * 100).toFixed(1)) : parseFloat(v.toFixed(2))
                  : null
                return { month: label.slice(0, 3), value: displayValue }
              })
              const hasData = chartData.some(d => d.value !== null)
              const primaryCalcSm = kpi.sub_metrics.find(sm => sm.is_calculated)
              const unit = primaryCalcSm?.unit || kpi.sub_metrics[0]?.unit || ''
              const currentVals = allActuals[currentMonth] || {}
              const { value: currentV, status: currentStatus } = statusFor(kpi, currentVals)
              const chartConfig: ChartConfig = { value: { label: kpi.name, color: '#CC1F1F' } }

              return (
                <div key={kpi.id} className="bg-white border border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
                  <div className="px-6 pt-4 pb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#282828] text-sm">{kpi.name}</span>
                        <StatusBadge status={currentStatus} />
                      </div>
                      <div className="text-[#737373] text-xs mt-0.5 font-normal">Target: {kpi.target_text}</div>
                    </div>
                    {currentV !== null && (
                      <div className="text-right shrink-0">
                        <div className="text-lg font-medium text-[#282828]">
                          {unit === '%' ? `${(currentV * 100).toFixed(1)}%`
                            : unit === 'x' ? `${currentV.toFixed(2)}×`
                            : currentV.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </div>
                        <div className="text-[10px] text-[#737373]">{MONTHS[currentMonth - 1]}</div>
                      </div>
                    )}
                  </div>

                  {hasData && (
                    <div className="px-2 pb-1">
                      <ChartContainer config={chartConfig} className="h-[100px] w-full aspect-auto">
                        <AreaChart data={chartData} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`grad-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#CC1F1F" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#CC1F1F" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F2F2F2" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#AAAAAA' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: '#AAAAAA' }} tickLine={false} axisLine={false} width={36} />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                indicator="dot"
                                formatter={(value) => [unit === '%' ? `${value}%` : `${value}`, kpi.name]}
                              />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#CC1F1F"
                            strokeWidth={1.5}
                            fill={`url(#grad-${kpi.id})`}
                            connectNulls={false}
                            dot={false}
                            activeDot={{ r: 3, fill: '#CC1F1F' }}
                          />
                        </AreaChart>
                      </ChartContainer>
                    </div>
                  )}

                  <div className="px-5 py-3 border-t border-[#e5e5e5]">
                    <MonthGrid data={monthStatuses} compact />
                  </div>
                </div>
              )
            })}
          </div>
        )}
          </div>
        </main>

        {/* Right: add-ons */}
        <aside className="hidden lg:block w-[400px] shrink-0 overflow-y-auto">
          <AddOnsPanel />
        </aside>
      </div>
    </div>
  )
}
