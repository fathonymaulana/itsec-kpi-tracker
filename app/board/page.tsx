'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  AltArrowDownLineDuotone as ChevronDown,
  AltArrowUpLineDuotone as ChevronUp,
  GraphNewUpLineDuotone as TrendingUp,
  MinusCircleLineDuotone as Minus,
  ClipboardCheckLineDuotone as FileSearch,
  ChartLineDuotone as ChartLine, ChartBold as ChartBold,
  ListLineDuotone as ListLine, ListBold as ListBold,
} from '@solar-icons/react-perf'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { AnimatedAside } from '@/components/layout/AnimatedAside'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { MonthGrid } from '@/components/kpi/MonthGrid'
import { MonthRangePicker, type MonthPeriod } from '@/components/kpi/MonthRangePicker'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, type ChartConfig } from '@/components/ui/chart'
import { getStatus, MONTHS, getDefaultMonth, getDefaultYear, type KpiStatus } from '@/lib/status'
import { getPeriodStatuses, resolvePrimaryValue, type SubMetricLike } from '@/lib/kpi-primary'
import { StatusBadge } from '@/components/kpi/StatusBadge'
import { DownloadReportButton } from '@/components/ui/download-report-button'
import { Button } from '@/components/ui/button'
import { cn, iconHoverClass } from '@/lib/utils'

const CURRENT_YEAR = new Date().getFullYear()

interface DeptSummary {
  dept_id: string
  department_name: string
  total: number
  on_track: number
  watch: number
  off_track: number
  no_data: number
  month_statuses: Partial<Record<number, KpiStatus>>
}

interface DeptKpiSummary {
  id: number
  name: string
  target_text: string
  status: KpiStatus
}

// Status colors are semantic (green/amber/red/gray for on-track/watch/off-track/no-data) and stay
// distinct from the app's default black chart color, which is reserved for single-series trend charts.
// Referencing the CSS custom properties (not literal hex) is what makes these respond to dark mode —
// inline style="color:#hex" never sees the .dark class at all, only var() lookups do.
const STATUS_COLORS = {
  on_track: 'var(--success-text)',
  watch: 'var(--warning-text)',
  off_track: 'var(--danger-text)',
  no_data: 'var(--ink-faint)',
}

const chartConfig: ChartConfig = {
  onTrack: { label: 'On Track', color: STATUS_COLORS.on_track },
  watch: { label: 'Watch', color: STATUS_COLORS.watch },
  offTrack: { label: 'Off Track', color: STATUS_COLORS.off_track },
  noData: { label: 'No Data', color: STATUS_COLORS.no_data },
}

// Custom legend (not the shared ChartLegendContent) — that component's default swatch is a small
// square rather than a circle, so this reads chartConfig's own solid color values directly and
// renders them as circles instead, per the requested legend style.
function ChartLegendCircles() {
  return (
    <div className="flex items-center justify-center gap-4 pt-3 flex-wrap">
      {Object.entries(chartConfig).map(([key, cfg]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
          <span className="text-xs text-ink-muted">{cfg.label}</span>
        </div>
      ))}
    </div>
  )
}

// Value label centered inside each stacked bar segment — skips rendering below ~20px of width so a
// 2-3 digit number never overflows a sliver-thin segment. White text reads correctly on every status
// color in both themes since each segment is a solid, fairly saturated fill either way.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarSegmentLabel(props: any) {
  const { x, y, width, height, value } = props
  if (!value || width < 20) return null
  return (
    <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={13} fontWeight={600}>
      {value}
    </text>
  )
}

export default function BoardPage() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [month, setMonth] = useState(getDefaultMonth())
  const [year, setYear] = useState(getDefaultYear())
  const [summaries, setSummaries] = useState<DeptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [deptKpiDetails, setDeptKpiDetails] = useState<Record<string, DeptKpiSummary[]>>({})
  const [loadingDeptDetails, setLoadingDeptDetails] = useState<Set<string>>(new Set())
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [view, setView] = useState<'charts' | 'table'>('charts')

  // Full-year breakdown (Table tab only) — independent of the single `month` above, which still
  // drives the stat cards/chart. Board summary's month_statuses already covers all 12 months of
  // whatever year is requested, so a range spanning one year needs just one fetch; a range crossing
  // a year boundary fetches each year involved and merges them.
  const [rangeFrom, setRangeFrom] = useState<MonthPeriod>({ year: getDefaultYear(), month: 1 })
  const [rangeTo, setRangeTo] = useState<MonthPeriod>({ year: getDefaultYear(), month: 12 })
  const [yearSummaries, setYearSummaries] = useState<Record<number, DeptSummary[]>>({})

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (user.role === 'dept_head') { router.push('/dept'); return }
  }, [user, router, ready])

  const fetchData = useCallback(async () => {
    if (!user || !token) return
    setLoading(true)
    try {
      // /api/board/summary already aggregates strictly one department per row, keyed by dept_id —
      // no department's figures ever blend into another's here or in the table/chart below.
      const sumRes = await fetch(`/api/board/summary/${year}?month=${month}`, { headers: authHeaders(token) })
      const sumData = await sumRes.json()
      setSummaries(sumData.departments || [])
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [user, token, year, month])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  const fetchYearSummary = useCallback(async (y: number) => {
    if (!token) return
    try {
      const r = await fetch(`/api/board/summary/${y}`, { headers: authHeaders(token) })
      const d = await r.json()
      setYearSummaries(prev => ({ ...prev, [y]: d.departments || [] }))
    } catch { /* non-fatal */ }
  }, [token])

  useEffect(() => {
    if (!user) return
    for (const y of Array.from(new Set([rangeFrom.year, rangeTo.year]))) {
      if (!yearSummaries[y]) fetchYearSummary(y)
    }
  }, [user, rangeFrom.year, rangeTo.year, yearSummaries, fetchYearSummary])

  // Every {year, month} period from rangeFrom to rangeTo inclusive, in order.
  const rangePeriods: MonthPeriod[] = []
  {
    let y = rangeFrom.year, m = rangeFrom.month
    while (y < rangeTo.year || (y === rangeTo.year && m <= rangeTo.month)) {
      rangePeriods.push({ year: y, month: m })
      m++
      if (m > 12) { m = 1; y++ }
    }
  }
  const statusForPeriod = (deptId: string, p: MonthPeriod): KpiStatus | undefined =>
    yearSummaries[p.year]?.find(d => d.dept_id === deptId)?.month_statuses[p.month]

  // Lazy-loaded on first expand — the board summary endpoint only carries aggregate counts, not KPI
  // names/targets, so seeing the actual per-KPI breakdown for one department means a real fetch.
  const fetchDeptKpiDetails = useCallback(async (deptId: string) => {
    if (!token || deptKpiDetails[deptId] || loadingDeptDetails.has(deptId)) return
    setLoadingDeptDetails(prev => new Set(prev).add(deptId))
    try {
      const [kpiRes, actRes] = await Promise.all([
        fetch(`/api/departments/${deptId}/kpis`, { headers: authHeaders(token) }),
        fetch(`/api/actuals?dept_id=${deptId}&year=${year}`, { headers: authHeaders(token) }),
      ])
      const kpiData = await kpiRes.json()
      const actData = await actRes.json()
      const actualsByMonth: Record<number, Record<number, number>> = {}
      for (const a of (actData.actuals || [])) {
        if (!actualsByMonth[a.month]) actualsByMonth[a.month] = {}
        actualsByMonth[a.month][a.sub_metric_id] = a.value
      }
      interface KpiRow {
        id: number; name: string; target_text: string; numeric_target: number | null; direction: number
        frequency?: string | null; sub_metrics: (SubMetricLike & { unit: string })[]
      }
      const summariesForDept: DeptKpiSummary[] = (kpiData.kpis || []).map((kpi: KpiRow) => {
        const { overall } = getPeriodStatuses(kpi.sub_metrics, actualsByMonth, kpi.frequency, month)
        const status = overall ?? getStatus(
          resolvePrimaryValue(kpi.sub_metrics, actualsByMonth[month] || {}),
          kpi.numeric_target,
          kpi.direction
        )
        return { id: kpi.id, name: kpi.name, target_text: kpi.target_text, status }
      })
      setDeptKpiDetails(prev => ({ ...prev, [deptId]: summariesForDept }))
    } catch { /* non-fatal */ }
    finally {
      setLoadingDeptDetails(prev => { const next = new Set(prev); next.delete(deptId); return next })
    }
  }, [token, year, month, deptKpiDetails, loadingDeptDetails])

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) }
      else { next.add(id); fetchDeptKpiDetails(id) }
      return next
    })
  }

  if (!ready || !user) return <PageSkeleton />

  // Totals across all depts
  const totals = summaries.reduce((acc, d) => ({
    total: acc.total + d.total,
    on_track: acc.on_track + d.on_track,
    watch: acc.watch + d.watch,
    off_track: acc.off_track + d.off_track,
    no_data: acc.no_data + d.no_data,
  }), { total: 0, on_track: 0, watch: 0, off_track: 0, no_data: 0 })

  // Bar chart data: one bar group per dept
  const chartData = summaries.map(d => ({
    name: d.department_name.length > 8 ? d.dept_id.slice(0, 8) : d.department_name,
    onTrack: d.on_track,
    watch: d.watch,
    offTrack: d.off_track,
    noData: d.no_data,
  }))

  const pct = (n: number) => totals.total > 0 ? Math.round(n / totals.total * 100) : 0

  return (
    <div className="h-screen flex flex-col bg-app overflow-hidden">
      <DeptTopNav
        leftPanelOpen={leftPanelOpen}
        onToggleLeftPanel={() => setLeftPanelOpen(v => !v)}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={() => setRightPanelOpen(v => !v)}
      />

      <div className="flex-1 flex overflow-hidden">
        <AnimatedAside open={leftPanelOpen} width={350} side="left" className="hidden md:block" contentClassName="p-12 overflow-y-auto">
          <DateSidebar
            year={year}
            onYearChange={setYear}
            month={month}
            onMonthChange={setMonth}
            minYear={CURRENT_YEAR - 1}
            maxYear={CURRENT_YEAR + 1}
          />
        </AnimatedAside>

        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Dashboard</h1>
                <p className="text-sm text-ink-muted mt-1">
                  Every department&apos;s KPI status for {MONTHS[month - 1]} {year}, at a glance.
                </p>
              </div>
              <DownloadReportButton
                title={`Department KPI Status — ${MONTHS[month - 1]} ${year}`}
                filename={`department-kpi-status-${year}-${String(month).padStart(2, '0')}`}
                columns={[
                  { key: 'department_name', label: 'Department', width: 28 },
                  { key: 'total', label: 'Total KPIs' },
                  { key: 'on_track', label: 'On Track' },
                  { key: 'watch', label: 'Watch' },
                  { key: 'off_track', label: 'Off Track' },
                  { key: 'no_data', label: 'No Data' },
                ]}
                rows={summaries.map(d => ({
                  department_name: d.department_name,
                  total: d.total,
                  on_track: d.on_track,
                  watch: d.watch,
                  off_track: d.off_track,
                  no_data: d.no_data,
                }))}
              />
            </div>

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'On Track', value: totals.on_track, pct: pct(totals.on_track), color: 'var(--success-text)', border: 'var(--success-soft-border)', Icon: TrendingUp },
                { label: 'Watch', value: totals.watch, pct: pct(totals.watch), color: 'var(--warning-text)', border: 'var(--warning-soft-border)', Icon: Minus },
                { label: 'Off Track', value: totals.off_track, pct: pct(totals.off_track), color: 'var(--danger-text)', border: 'var(--danger-soft-border)', Icon: Minus },
                { label: 'No Data', value: totals.no_data, pct: pct(totals.no_data), color: 'var(--ink-faint)', border: 'var(--divider)', Icon: Minus },
              ].map(s => (
                <div key={s.label} className="bg-panel border shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-4 flex items-start gap-3" style={{ borderColor: s.border }}>
                  <s.Icon size={16} style={{ color: s.color }} className="mt-0.5 shrink-0" />
                  <div>
                    <div className="text-2xl font-semibold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs text-ink-muted font-normal">{s.label}</div>
                    <div className="text-[11px] mt-0.5 font-normal" style={{ color: s.color }}>{s.pct}%</div>
                  </div>
                </div>
              ))}
            </div>

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

              <TabsContent value="charts">
                {/* Stacked bar chart */}
                {!loading && chartData.length > 0 && (
                  <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl p-5 mb-6">
                    <h3 className="font-medium text-ink text-sm mb-4">Department KPI Status — {MONTHS[month - 1]} {year}</h3>
                    <ChartContainer config={chartConfig} className="h-[380px] w-full aspect-auto">
                      <BarChart data={chartData} layout="vertical" barSize={34} barCategoryGap="28%" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--divider)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} tickLine={false} axisLine={false} width={84} />
                        <ChartTooltip cursor={{ fill: 'var(--panel-soft-bg)' }} content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendCircles />} />
                        {/* Solid fills from chartConfig's own theme-aware CSS vars (ChartContainer auto-
                            generates --color-onTrack etc. from chartConfig) — no gradient defs needed. */}
                        <Bar dataKey="onTrack" stackId="a" fill="var(--color-onTrack)" radius={[6, 6, 6, 6]}>
                          <LabelList dataKey="onTrack" content={<BarSegmentLabel />} />
                        </Bar>
                        <Bar dataKey="watch" stackId="a" fill="var(--color-watch)" radius={[6, 6, 6, 6]}>
                          <LabelList dataKey="watch" content={<BarSegmentLabel />} />
                        </Bar>
                        <Bar dataKey="offTrack" stackId="a" fill="var(--color-offTrack)" radius={[6, 6, 6, 6]}>
                          <LabelList dataKey="offTrack" content={<BarSegmentLabel />} />
                        </Bar>
                        <Bar dataKey="noData" stackId="a" fill="var(--color-noData)" radius={[6, 6, 6, 6]}>
                          <LabelList dataKey="noData" content={<BarSegmentLabel />} />
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  </div>
                )}

                {/* Department accordion */}
                <div className="space-y-2">
                  <h3 className="font-medium text-ink text-sm mb-3">Department Breakdown</h3>
                  {loading ? (
                    <div className="space-y-2">
                      {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-panel border border-divider rounded-3xl animate-pulse" />)}
                    </div>
                  ) : summaries.map(dept => {
                    const expanded = expandedDepts.has(dept.dept_id)
                    const onPct = dept.total > 0 ? Math.round(dept.on_track / dept.total * 100) : 0
                    return (
                      <div key={dept.dept_id} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
                        <button
                          onClick={() => toggleDept(dept.dept_id)}
                          className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-app transition-colors"
                        >
                          <div className="flex-1 text-left">
                            <div className="text-sm font-medium text-ink">{dept.department_name}</div>
                            <div className="text-xs text-ink-faint mt-0.5 font-normal">{dept.total} KPIs · {onPct}% on track</div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex gap-1.5">
                              {[
                                { v: dept.on_track, c: 'var(--success-text)', bg: 'var(--success-soft-bg)' },
                                { v: dept.watch, c: 'var(--warning-text)', bg: 'var(--warning-soft-bg)' },
                                { v: dept.off_track, c: 'var(--danger-text)', bg: 'var(--danger-soft-bg)' },
                                { v: dept.no_data, c: 'var(--ink-faint)', bg: 'var(--panel-soft-bg)' },
                              ].map((s, i) => s.v > 0 && (
                                <span key={i} className="size-5 shrink-0 flex items-center justify-center text-[10px] font-medium rounded-full" style={{ color: s.c, background: s.bg }}>
                                  {s.v}
                                </span>
                              ))}
                            </div>
                            {expanded ? <ChevronUp size={14} className="text-ink-faint" /> : <ChevronDown size={14} className="text-ink-faint" />}
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-divider px-5 py-3 space-y-3">
                            <MonthGrid data={dept.month_statuses} compact />
                            {loadingDeptDetails.has(dept.dept_id) ? (
                              <div className="space-y-1.5">
                                {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-panel-soft rounded-lg animate-pulse" />)}
                              </div>
                            ) : deptKpiDetails[dept.dept_id] && (
                              <div className="space-y-1">
                                {deptKpiDetails[dept.dept_id].map(k => (
                                  <div key={k.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-panel-soft">
                                    <div className="min-w-0">
                                      <div className="text-xs font-medium text-ink truncate">{k.name}</div>
                                      <div className="text-[10px] text-ink-faint truncate">Target: {k.target_text}</div>
                                    </div>
                                    <StatusBadge status={k.status} size="sm" />
                                  </div>
                                ))}
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin?dept=${dept.dept_id}`)}
                              className={cn('rounded-full border-divider bg-panel text-ink', iconHoverClass)}
                            >
                              <FileSearch size={13} />
                              View KPI details & sources
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="table">
                {/* Mobile/tablet: one card per department, matching the Figma "Table Card
                    Responsive" component exactly — a muted header (label + value, View details
                    button), one divided label/value row per metric, and a footer stat. Replaces
                    the earlier 4-up colored-badge grid with this row-based layout. */}
                <div className="flex md:hidden flex-col gap-3 mb-6">
                  {summaries.map(dept => {
                    const onPct = dept.total > 0 ? Math.round(dept.on_track / dept.total * 100) : 0
                    const rows = [
                      { label: 'KPIs', value: dept.total },
                      { label: 'On Track', value: dept.on_track },
                      { label: 'Watch', value: dept.watch },
                      { label: 'Off Track', value: dept.off_track },
                      { label: 'No Data', value: dept.no_data },
                    ]
                    return (
                      <div key={dept.dept_id} className="bg-panel border border-divider rounded-3xl overflow-hidden">
                        <div className="bg-panel-soft flex items-center justify-between px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] leading-[14px] text-ink-faint">Department</span>
                            <span className="text-sm font-medium text-ink">{dept.department_name}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin?dept=${dept.dept_id}`)}
                            className={cn('rounded-full border-divider bg-panel text-ink shadow-xs', iconHoverClass)}
                          >
                            <FileSearch size={14} />
                            View details
                          </Button>
                        </div>
                        {rows.map(r => (
                          <div key={r.label} className="flex items-center justify-between border-t border-divider">
                            <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">{r.label}</span>
                            <span className="flex-1 py-3 text-sm font-medium text-ink text-center">{r.value}</span>
                          </div>
                        ))}
                        <div className="border-t border-divider flex flex-col items-center gap-1.5 px-6 py-4">
                          <span className="text-lg font-semibold text-ink">{onPct}%</span>
                          <span className="text-[10px] text-ink-faint">On Track %</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="hidden md:block bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead className="text-right">KPIs</TableHead>
                        <TableHead className="text-right">On Track</TableHead>
                        <TableHead className="text-right">Watch</TableHead>
                        <TableHead className="text-right">Off Track</TableHead>
                        <TableHead className="text-right">No Data</TableHead>
                        <TableHead className="text-right">On Track %</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaries.map(dept => {
                        const onPct = dept.total > 0 ? Math.round(dept.on_track / dept.total * 100) : 0
                        return (
                          <TableRow key={dept.dept_id}>
                            <TableCell className="font-medium text-ink">{dept.department_name}</TableCell>
                            <TableCell className="text-right">{dept.total}</TableCell>
                            <TableCell className="text-right" style={{ color: STATUS_COLORS.on_track }}>{dept.on_track}</TableCell>
                            <TableCell className="text-right" style={{ color: STATUS_COLORS.watch }}>{dept.watch}</TableCell>
                            <TableCell className="text-right" style={{ color: STATUS_COLORS.off_track }}>{dept.off_track}</TableCell>
                            <TableCell className="text-right text-ink-muted">{dept.no_data}</TableCell>
                            <TableCell className="text-right font-medium text-ink">{onPct}%</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/admin?dept=${dept.dept_id}`)}
                                className={cn('rounded-full border-divider bg-panel text-ink', iconHoverClass)}
                              >
                                <FileSearch size={13} />
                                View details & sources
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Full-year breakdown — every month in the selected range, per department */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="font-medium text-ink text-sm">Full Period Overview</h3>
                  <MonthRangePicker
                    from={rangeFrom}
                    to={rangeTo}
                    onChange={(f, t) => { setRangeFrom(f); setRangeTo(t) }}
                    minYear={CURRENT_YEAR - 2}
                    maxYear={CURRENT_YEAR + 1}
                  />
                </div>
                {/* Mobile/tablet: one card per department, matching the Figma "Table Card
                    Responsive" pattern used everywhere else — muted header (department name),
                    one divided label/value row per period with a status dot instead of text. */}
                <div className="flex md:hidden flex-col gap-3">
                  {summaries.map(dept => (
                    <div key={dept.dept_id} className="bg-panel border border-divider rounded-3xl overflow-hidden">
                      <div className="bg-panel-soft flex items-center px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[10px] text-ink-faint">Department</span>
                          <span className="text-sm font-medium text-ink">{dept.department_name}</span>
                        </div>
                      </div>
                      {rangePeriods.map(p => {
                        const status = statusForPeriod(dept.dept_id, p)
                        const color = status ? STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? '#D1D5DB' : '#E5E5E5'
                        return (
                          <div key={`${p.year}-${p.month}`} className="flex items-center justify-between border-t border-divider">
                            <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">{MONTHS[p.month - 1].slice(0, 3)} {p.year}</span>
                            <div className="flex-1 py-3 flex justify-center">
                              <span
                                title={status ?? 'no data'}
                                className="inline-block size-2.5 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>

                <div className="hidden md:block bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-panel">Department</TableHead>
                        {rangePeriods.map(p => (
                          <TableHead key={`${p.year}-${p.month}`} className="text-center whitespace-nowrap">
                            {MONTHS[p.month - 1].slice(0, 3)} {p.year !== rangePeriods[0].year || p.year !== rangePeriods[rangePeriods.length - 1].year ? String(p.year).slice(2) : ''}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaries.map(dept => (
                        <TableRow key={dept.dept_id}>
                          <TableCell className="font-medium text-ink sticky left-0 bg-panel">{dept.department_name}</TableCell>
                          {rangePeriods.map(p => {
                            const status = statusForPeriod(dept.dept_id, p)
                            const color = status ? STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? '#D1D5DB' : '#E5E5E5'
                            return (
                              <TableCell key={`${p.year}-${p.month}`} className="text-center">
                                <span
                                  title={`${MONTHS[p.month - 1]} ${p.year}: ${status ?? 'no data'}`}
                                  className="inline-block size-2.5 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        <AnimatedAside open={rightPanelOpen} width={400} side="right" className="hidden lg:block" contentClassName="overflow-y-auto">
          <AddOnsPanel />
        </AnimatedAside>
      </div>
    </div>
  )
}
