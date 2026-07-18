'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  GraphNewUpLineDuotone as TrendingUp,
  EyeLineDuotone as Eye,
  GraphDownNewLineDuotone as TrendingDown,
  MinusCircleLineDuotone as CircleDashed,
  ChartLineDuotone as ChartLine, ChartBold as ChartBold,
  ListLineDuotone as ListLine, ListBold as ListBold,
} from '@solar-icons/react-perf'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { AnimatedAside } from '@/components/layout/AnimatedAside'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { MonthGrid } from '@/components/kpi/MonthGrid'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { getStatus, getStatusLabel, getDefaultMonth, MONTHS, type KpiStatus } from '@/lib/status'
import { getPrimarySubMetric, resolvePrimaryValue, getPeriodStatuses } from '@/lib/kpi-primary'
import { parsePeriod, periodLabel } from '@/lib/frequency'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { DownloadReportButton } from '@/components/ui/download-report-button'

const CURRENT_YEAR = new Date().getFullYear()
// var(--foreground), not a literal hex — the fixed '#171717' this used to be stayed black in dark
// mode too, so the line and its gradient fill went nearly invisible against a dark panel.
const CHART_COLOR = 'var(--foreground)'

interface SubMetric {
  id: number; name: string; unit: string;
  is_calculated: number; formula_key: string | null; calc_input_positions: string | null
  numeric_target: number | null; direction: number | null
}
interface Kpi {
  id: number; name: string; target_text: string; numeric_target: number | null; direction: number
  frequency?: string | null
  sub_metrics: SubMetric[]
}

// Status is the worst status among every sub-metric that carries its own target (set per-row, not
// per-KPI — see lib/kpi-primary.ts) — a KPI with several independently-targeted components (e.g.
// "≥4 agreements; ≥100 leads; ≥IDR5B pipeline") is off track if ANY of them is, not just the primary
// one. Evaluated over the KPI's own reporting period (see lib/frequency.ts) — a "≥4/year" target
// isn't judged against a single month's raw entry, it's judged against the year's running total, so
// entering "1" in one month of a 4-per-year target doesn't wrongly flag off track. Falls back to the
// primary sub-metric's target for simple single-target KPIs. Matches the logic used server-side in
// app/api/board/summary/[year] and in KpiCard's per-row badges.
// kpi.numeric_target/direction are stale for KPIs with multiple components and must not be used here.
function statusFor(kpi: Kpi, actualsByMonth: Record<number, Record<number, number>>, month: number): { value: number | null; status: KpiStatus } {
  const primary = getPrimarySubMetric(kpi.sub_metrics)
  const value = resolvePrimaryValue(kpi.sub_metrics, actualsByMonth[month] || {})
  const { overall } = getPeriodStatuses(kpi.sub_metrics, actualsByMonth, kpi.frequency, month)
  const status = overall ?? getStatus(value, primary?.numeric_target ?? null, primary?.direction ?? 1)
  return { value, status }
}

function formatValue(v: number | null, unit: string): string {
  if (v === null) return '—'
  if (unit === '%') return `${(v * 100).toFixed(1)}%`
  if (unit === 'x') return `${v.toFixed(2)}×`
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

export default function DeptDashboard() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [year, setYear] = useState(CURRENT_YEAR)
  const [allActuals, setAllActuals] = useState<Record<number, Record<number, number>>>({}) // month → {smId → value}
  const [loading, setLoading] = useState(true)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [view, setView] = useState<'charts' | 'table'>('charts')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    // Data here is fetched scoped to the signed-in dept_head's own department only
    // (see the /api/departments/[id]/kpis and /api/actuals calls below) — a department head
    // can never pull another department's KPIs through this page.
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

  // Stats — the "current" period for the stat cards is the same "previous calendar month" default
  // Data Entry uses (see getDefaultMonth), not the literal in-progress calendar month, since actuals
  // for the still-running month haven't been submitted yet. Using the real current month here was why
  // the stat cards stayed at "No Data" right after a dept_head submitted last month's data.
  const currentMonth = getDefaultMonth()
  const statuses = kpis.map(kpi => statusFor(kpi, allActuals, currentMonth).status)
  const onTrack = statuses.filter(s => s === 'on_track').length
  const watch = statuses.filter(s => s === 'watch').length
  const offTrack = statuses.filter(s => s === 'off_track').length
  const noData = statuses.filter(s => s === 'no_data').length

  // Precompute each KPI's month-by-month series once, shared by both the Charts and Table views
  const kpisWithData = kpis.map(kpi => {
    const monthStatuses: Partial<Record<number, KpiStatus>> = {}
    const primaryCalcSm = kpi.sub_metrics.find(sm => sm.is_calculated)
    const unit = primaryCalcSm?.unit || kpi.sub_metrics[0]?.unit || ''
    const monthValues = MONTHS.map((label, mi) => {
      const m = mi + 1
      const vals = allActuals[m] || {}
      const v = resolvePrimaryValue(kpi.sub_metrics, vals)
      monthStatuses[m] = statusFor(kpi, allActuals, m).status
      const displayValue = v !== null
        ? unit === '%' ? parseFloat((v * 100).toFixed(1)) : parseFloat(v.toFixed(2))
        : null
      return { month: label.slice(0, 3), value: displayValue, raw: v }
    })
    const hasData = monthValues.some(d => d.value !== null)
    const period = parsePeriod(kpi.frequency)
    const { value: currentV } = statusFor(kpi, allActuals, currentMonth)
    return { kpi, unit, monthValues, monthStatuses, hasData, currentV, period }
  })

  if (!ready || !user) return <PageSkeleton />

  return (
    <div className="h-screen flex flex-col bg-app overflow-hidden">
      <DeptTopNav
        leftPanelOpen={leftPanelOpen}
        onToggleLeftPanel={() => setLeftPanelOpen(v => !v)}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={() => setRightPanelOpen(v => !v)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: clock + year picker */}
        <AnimatedAside open={leftPanelOpen} width={350} side="left" className="hidden md:block" contentClassName="p-12 overflow-y-auto">
          <DateSidebar year={year} onYearChange={setYear} minYear={CURRENT_YEAR - 1} maxYear={CURRENT_YEAR} />
        </AnimatedAside>

        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Dashboard</h1>
                <p className="text-sm text-ink-muted mt-1 max-w-xl">
                  {kpis.length > 0
                    ? `A month-by-month view of every KPI ${user.dept_name} tracks, so you can spot trends before they become problems.`
                    : 'Once KPIs are configured for your department, their trends will show up here.'}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-ink-muted mt-1">{kpis.length} KPIs</span>
                <DownloadReportButton
                  title={`${user.dept_name} — KPI Status (${MONTHS[currentMonth - 1]} ${year})`}
                  filename={`${(user.dept_name || 'department').toLowerCase().replace(/\s+/g, '-')}-kpi-status-${year}-${String(currentMonth).padStart(2, '0')}`}
                  columns={[
                    { key: 'kpi', label: 'KPI', width: 32 },
                    { key: 'target', label: 'Target', width: 28 },
                    { key: 'value', label: 'Current Value' },
                    { key: 'status', label: 'Status' },
                  ]}
                  rows={kpisWithData.map(({ kpi, unit, currentV }) => ({
                    kpi: kpi.name,
                    target: kpi.target_text,
                    value: formatValue(currentV, unit),
                    status: getStatusLabel(statusFor(kpi, allActuals, currentMonth).status),
                  }))}
                />
              </div>
            </div>

            {/* Stat summary */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: 'On Track', value: onTrack, color: 'var(--success-text)', Icon: TrendingUp, caption: 'performing at or above target' },
                { label: 'Watch', value: watch, color: 'var(--warning-text)', Icon: Eye, caption: 'trending toward target, worth watching' },
                { label: 'Off Track', value: offTrack, color: 'var(--danger-text)', Icon: TrendingDown, caption: 'below target — needs attention' },
                { label: 'No Data', value: noData, color: 'var(--ink-muted)', Icon: CircleDashed, caption: 'not yet entered this month' },
              ].map(s => {
                const pct = kpis.length > 0 ? Math.round((s.value / kpis.length) * 100) : 0
                return (
                  <div key={s.label} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-6 flex flex-col gap-1.5">
                    <div className="text-sm text-ink-muted">{s.label}</div>
                    <div className="text-[40px] leading-[48px] font-medium text-ink tracking-[-0.5px]">{s.value}</div>
                    <div className="flex items-center gap-1">
                      <s.Icon size={14} style={{ color: s.color }} />
                      <span className="text-base font-semibold" style={{ color: s.color }}>{pct}%</span>
                      <span className="text-xs text-ink-muted">of {kpis.length || 0}</span>
                    </div>
                    <div className="text-xs text-ink-muted mt-1">{s.caption}</div>
                  </div>
                )
              })}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-panel border border-divider rounded-3xl animate-pulse" />)}
              </div>
            ) : (
              <Tabs value={view} onValueChange={v => v && setView(v as 'charts' | 'table')}>
                <TabsList variant="pill" className="mb-4">
                  <TabsTrigger value="charts">
                    {view === 'charts' ? <ChartBold data-icon="inline-start" size={14} /> : <ChartLine data-icon="inline-start" size={14} />}
                    Charts
                  </TabsTrigger>
                  <TabsTrigger value="table">
                    {view === 'table' ? <ListBold data-icon="inline-start" size={14} /> : <ListLine data-icon="inline-start" size={14} />}
                    Table
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="charts" className="space-y-4">
                  {kpisWithData.map(({ kpi, unit, monthValues, monthStatuses, hasData, currentV, period }) => {
                    const chartConfig: ChartConfig = { value: { label: kpi.name, color: CHART_COLOR } }
                    return (
                      <div key={kpi.id} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
                        <div className="px-6 pt-4 pb-3 flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ink text-sm">{kpi.name}</span>
                              <span className="inline-flex items-center border border-divider bg-panel-soft text-ink-muted px-2.5 py-1 text-xs rounded font-medium tracking-wide">
                                {periodLabel(period)}
                              </span>
                            </div>
                            <div className="text-ink-muted text-xs mt-0.5 font-normal">Target: {kpi.target_text}</div>
                          </div>
                          {currentV !== null && (
                            <div className="text-right shrink-0">
                              <div className="text-lg font-medium text-ink">{formatValue(currentV, unit)}</div>
                              <div className="text-[10px] text-ink-muted">{MONTHS[currentMonth - 1]}</div>
                            </div>
                          )}
                        </div>

                        {hasData && (
                          <div className="px-2 pb-1">
                            <ChartContainer config={chartConfig} className="h-[100px] w-full aspect-auto">
                              <AreaChart data={monthValues} margin={{ top: 4, right: 12, left: -20, bottom: 0 }}>
                                <defs>
                                  <linearGradient id={`grad-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLOR} stopOpacity={0.15} />
                                    <stop offset="95%" stopColor={CHART_COLOR} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--divider)" vertical={false} />
                                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--ink-faint)' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: 'var(--ink-faint)' }} tickLine={false} axisLine={false} width={36} />
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
                                  stroke={CHART_COLOR}
                                  strokeWidth={1.5}
                                  fill={`url(#grad-${kpi.id})`}
                                  connectNulls={false}
                                  dot={false}
                                  activeDot={{ r: 3, fill: CHART_COLOR }}
                                />
                              </AreaChart>
                            </ChartContainer>
                          </div>
                        )}

                        <div className="px-5 py-3 border-t border-divider">
                          <MonthGrid data={monthStatuses} compact />
                        </div>
                      </div>
                    )
                  })}
                </TabsContent>

                <TabsContent value="table">
                  {/* Mobile/tablet: one card per KPI, matching the Figma "Table Card Responsive"
                      pattern used everywhere else — muted header (KPI + frequency), one divided
                      label/value row per month. The 13-column table below stays desktop-only. */}
                  <div className="flex md:hidden flex-col gap-3">
                    {kpisWithData.map(({ kpi, unit, monthValues, period }) => (
                      <div key={kpi.id} className="bg-panel border border-divider rounded-3xl overflow-hidden">
                        <div className="bg-panel-soft flex items-center justify-between px-6 py-4 gap-3">
                          <div className="min-w-0 flex flex-col gap-1.5">
                            <span className="text-[10px] text-ink-faint">KPI</span>
                            <span className="text-sm font-medium text-ink truncate">{kpi.name}</span>
                          </div>
                          <span className="inline-flex items-center border border-divider bg-panel text-ink-muted px-2.5 py-1 text-xs rounded font-medium tracking-wide shrink-0">
                            {periodLabel(period)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between border-t border-divider">
                          <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">Target</span>
                          <span className="flex-1 py-3 text-sm font-medium text-ink text-center">{kpi.target_text}</span>
                        </div>
                        {MONTHS.map((m, i) => (
                          <div key={m} className="flex items-center justify-between border-t border-divider">
                            <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">{m}</span>
                            <span className="flex-1 py-3 text-sm font-medium text-ink text-center">{formatValue(monthValues[i].raw, unit)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className="hidden md:block bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 bg-panel">KPI</TableHead>
                          {MONTHS.map(m => <TableHead key={m} className="text-right">{m.slice(0, 3)}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kpisWithData.map(({ kpi, unit, monthValues, period }) => (
                          <TableRow key={kpi.id}>
                            <TableCell className="sticky left-0 bg-panel font-medium text-ink">
                              <div className="flex items-center gap-2">
                                {kpi.name}
                                <span className="inline-flex items-center border border-divider bg-panel-soft text-ink-muted px-2.5 py-1 text-xs rounded font-medium tracking-wide">
                                  {periodLabel(period)}
                                </span>
                              </div>
                              <div className="text-xs text-ink-muted font-normal mt-0.5">Target: {kpi.target_text}</div>
                            </TableCell>
                            {monthValues.map((mv, i) => (
                              <TableCell key={i} className="text-right text-ink whitespace-nowrap">
                                {formatValue(mv.raw, unit)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>

        {/* Right: add-ons */}
        <AnimatedAside open={rightPanelOpen} width={400} side="right" className="hidden lg:block" contentClassName="overflow-y-auto">
          <AddOnsPanel />
        </AnimatedAside>
      </div>
    </div>
  )
}
