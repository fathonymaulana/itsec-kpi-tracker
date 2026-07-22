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
import { DateSidebar, type MonthPeriod } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { AnimatedAside } from '@/components/layout/AnimatedAside'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { useResponsivePanels } from '@/hooks/use-responsive-panels'
import { KpiSparklineGrid } from '@/components/kpi/KpiSparklineGrid'
import { StatusBadge } from '@/components/kpi/StatusBadge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { getStatus, worstStatus, MONTHS, type KpiStatus } from '@/lib/status'
import { getPrimarySubMetric, resolvePrimaryValue, getPeriodStatuses } from '@/lib/kpi-primary'
import { parsePeriod, periodLabel } from '@/lib/frequency'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { DownloadReportButton } from '@/components/ui/download-report-button'
import { Badge } from '@/components/ui/badge'
import { CountUpNumber } from '@/components/ui/animated-number'
import { MobileDatePicker } from '@/components/kpi/MobileDatePicker'
import { CrossfadeSwap } from '@/components/ui/crossfade-swap'
import { cn } from '@/lib/utils'

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
  // Range picker — mirrors the CorPlan board dashboard's for consistency. Defaults to the full
  // current year (the page's previous behavior) rather than a single month, since these views are
  // trend charts first and foremost.
  const [rangeFrom, setRangeFrom] = useState<MonthPeriod>({ year: CURRENT_YEAR, month: 1 })
  const [rangeTo, setRangeTo] = useState<MonthPeriod>({ year: CURRENT_YEAR, month: 12 })
  // year → month → smId → value
  const [actualsByYearMonth, setActualsByYearMonth] = useState<Record<number, Record<number, Record<number, number>>>>({})
  const [loading, setLoading] = useState(true)
  const { leftPanelOpen, rightPanelOpen, toggleLeftPanel, toggleRightPanel } = useResponsivePanels()
  const [view, setView] = useState<'charts' | 'table'>('charts')

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    // Data here is fetched scoped to the signed-in dept_head's own department only
    // (see the /api/departments/[id]/kpis and /api/actuals calls below) — a department head
    // can never pull another department's KPIs through this page.
    if (user.role !== 'dept_head') { router.push('/board'); return }
  }, [user, router, ready])

  // Every calendar year the selected range touches — usually one, at most two given minYear/maxYear
  // below are only a year apart. Re-fetched whenever that set changes; narrowing the month endpoints
  // within an already-fetched year needs no new request, since filtering happens client-side.
  const years: number[] = []
  for (let y = rangeFrom.year; y <= rangeTo.year; y++) years.push(y)

  const fetchData = useCallback(async (yearsToFetch: number[]) => {
    if (!user || !token) return
    setLoading(true)
    try {
      const [kpiRes, ...actResList] = await Promise.all([
        fetch(`/api/departments/${user.dept_id}/kpis`, { headers: authHeaders(token) }),
        ...yearsToFetch.map(y => fetch(`/api/actuals?dept_id=${user.dept_id}&year=${y}`, { headers: authHeaders(token) })),
      ])
      const kpiData = await kpiRes.json()
      setKpis(kpiData.kpis || [])
      const byYearMonth: Record<number, Record<number, Record<number, number>>> = {}
      for (let i = 0; i < yearsToFetch.length; i++) {
        const actData = await actResList[i].json()
        const y = yearsToFetch[i]
        byYearMonth[y] = {}
        for (const a of (actData.actuals || [])) {
          if (!byYearMonth[y][a.month]) byYearMonth[y][a.month] = {}
          byYearMonth[y][a.month][a.sub_metric_id] = a.value
        }
      }
      setActualsByYearMonth(byYearMonth)
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [user, token])

  useEffect(() => { if (user) fetchData(years) }, [user, fetchData, rangeFrom.year, rangeTo.year]) // eslint-disable-line react-hooks/exhaustive-deps

  // Every {year, month} from rangeFrom to rangeTo inclusive, in order — the range picked in the
  // sidebar, same "worst wins" aggregation convention as the CorPlan board dashboard.
  const rangePeriods: MonthPeriod[] = []
  {
    let y = rangeFrom.year, m = rangeFrom.month
    while (y < rangeTo.year || (y === rangeTo.year && m <= rangeTo.month)) {
      rangePeriods.push({ year: y, month: m })
      m++
      if (m > 12) { m = 1; y++ }
    }
  }
  const isMultiYear = rangeFrom.year !== rangeTo.year
  const periodLbl = (p: MonthPeriod) => `${MONTHS[p.month - 1]} ${p.year}`
  const isSinglePeriod = rangeFrom.year === rangeTo.year && rangeFrom.month === rangeTo.month
  const rangeLabel = isSinglePeriod ? periodLbl(rangeFrom) : `${periodLbl(rangeFrom)} – ${periodLbl(rangeTo)}`

  // Stats reflect each KPI's worst status across the whole selected range — same range-aggregate
  // convention as the CorPlan board dashboard's stat cards, not just a single "current" month.
  const statuses = kpis.map(kpi =>
    worstStatus(rangePeriods.map(p => statusFor(kpi, actualsByYearMonth[p.year] || {}, p.month).status))
  )
  const onTrack = statuses.filter(s => s === 'on_track').length
  const watch = statuses.filter(s => s === 'watch').length
  const offTrack = statuses.filter(s => s === 'off_track').length
  const noData = statuses.filter(s => s === 'no_data').length

  // Precompute each KPI's series across the selected range once, shared by both the Charts and
  // Table views.
  const kpisWithData = kpis.map(kpi => {
    const primaryCalcSm = kpi.sub_metrics.find(sm => sm.is_calculated)
    const unit = primaryCalcSm?.unit || kpi.sub_metrics[0]?.unit || ''
    const monthValues = rangePeriods.map(p => {
      const actualsByMonth = actualsByYearMonth[p.year] || {}
      const { value: v, status } = statusFor(kpi, actualsByMonth, p.month)
      const displayValue = v !== null
        ? unit === '%' ? parseFloat((v * 100).toFixed(1)) : parseFloat(v.toFixed(2))
        : null
      const label = isMultiYear ? `${MONTHS[p.month - 1].slice(0, 3)} '${String(p.year).slice(2)}` : MONTHS[p.month - 1].slice(0, 3)
      // Status rides along with each point instead of a separate always-visible dot table — it only
      // surfaces when a chart tooltip is actually hovered, see the formatter below.
      return { month: label, value: displayValue, raw: v, status }
    })
    const hasData = monthValues.some(d => d.value !== null)
    const period = parsePeriod(kpi.frequency)
    // "Current" value shown beside the chart title is the latest period in the range — the trend
    // line covers the whole range, but a single headline number needs one period to anchor to.
    const { value: currentV } = statusFor(kpi, actualsByYearMonth[rangeTo.year] || {}, rangeTo.month)
    return { kpi, unit, monthValues, hasData, currentV, period }
  })

  if (!ready || !user) return <PageSkeleton />

  return (
    <div className="h-screen flex flex-col bg-app overflow-hidden">
      <DeptTopNav
        leftPanelOpen={leftPanelOpen}
        onToggleLeftPanel={toggleLeftPanel}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={toggleRightPanel}
      />

      {/* The scroll container spans edge-to-edge (both asides float above it, absolutely
          positioned) so its native scrollbar renders at the true right edge of the viewport
          instead of at whatever edge the right aside happened to be pushed to — only this center
          layer scrolls; the asides are pinned via position:absolute, not part of the scroll flow.
          Padding (not the asides' own layout) reserves their space, animated with the same
          duration/easing as AnimatedAside's own width tween so they move in lockstep. */}
      <div className="flex-1 relative overflow-hidden">
        {/* Left: clock + range picker — same control CorPlan's board dashboard uses, for consistency. */}
        <AnimatedAside open={leftPanelOpen} width={350} side="left" className="absolute inset-y-0 left-0 z-10 hidden md:block" contentClassName="py-8 px-6 overflow-y-auto">
          <DateSidebar
            year={rangeFrom.year}
            onYearChange={() => {}}
            month={rangeFrom.month}
            toYear={rangeTo.year}
            toMonth={rangeTo.month}
            onRangeChange={(f, t) => { setRangeFrom(f); setRangeTo(t) }}
            minYear={CURRENT_YEAR - 1}
            maxYear={CURRENT_YEAR}
          />
        </AnimatedAside>

        <div
          className={cn(
            'h-full overflow-y-auto overflow-x-hidden transition-[padding] duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
            leftPanelOpen ? 'md:pl-[350px]' : 'pl-0',
            rightPanelOpen ? 'lg:pr-[400px]' : 'pr-0'
          )}
        >
        <main className="min-w-0 px-4 sm:px-6 py-8">
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
                  title={`${user.dept_name} — KPI Status (${rangeLabel})`}
                  filename={`${(user.dept_name || 'department').toLowerCase().replace(/\s+/g, '-')}-kpi-status-${rangeFrom.year}-${String(rangeFrom.month).padStart(2, '0')}${isSinglePeriod ? '' : `-to-${rangeTo.year}-${String(rangeTo.month).padStart(2, '0')}`}`}
                  columns={[
                    { key: 'kpi', label: 'KPI', width: 32 },
                    { key: 'target', label: 'Target', width: 28 },
                    ...rangePeriods.map((p, i) => ({
                      key: `m${i + 1}`,
                      label: isMultiYear ? `${MONTHS[p.month - 1].slice(0, 3)} '${String(p.year).slice(2)}` : MONTHS[p.month - 1].slice(0, 3),
                      width: 12,
                    })),
                  ]}
                  rows={kpisWithData.map(({ kpi, unit, monthValues }) => {
                    const row: Record<string, string | number> = { kpi: kpi.name, target: kpi.target_text }
                    monthValues.forEach((mv, i) => { row[`m${i + 1}`] = formatValue(mv.raw, unit) })
                    return row
                  })}
                />
              </div>
            </div>

            <MobileDatePicker
              year={rangeFrom.year}
              onYearChange={() => {}}
              month={rangeFrom.month}
              toYear={rangeTo.year}
              toMonth={rangeTo.month}
              onRangeChange={(f, t) => { setRangeFrom(f); setRangeTo(t) }}
              minYear={CURRENT_YEAR - 1}
              maxYear={CURRENT_YEAR}
              className="mb-6"
            />

            {/* Stat summary */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                { label: 'On Track', variant: 'success' as const, value: onTrack, color: 'var(--success-text)', Icon: TrendingUp, caption: 'performing at or above target' },
                { label: 'Watch', variant: 'warning' as const, value: watch, color: 'var(--warning-text)', Icon: Eye, caption: 'trending toward target, worth watching' },
                { label: 'Off Track', variant: 'danger' as const, value: offTrack, color: 'var(--danger-text)', Icon: TrendingDown, caption: 'below target — needs attention' },
                { label: 'No Data', variant: 'outline' as const, value: noData, color: 'var(--ink-muted)', Icon: CircleDashed, caption: 'not yet entered this month' },
              ].map(s => {
                const pct = kpis.length > 0 ? Math.round((s.value / kpis.length) * 100) : 0
                return (
                  <div key={s.label} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-6 flex flex-col gap-1.5">
                    <Badge variant={s.variant} className="h-auto px-2 py-0.5 text-[10px] w-fit">{s.label}</Badge>
                    <CountUpNumber value={s.value} className="text-[40px] leading-[48px] font-medium text-ink tracking-[-0.5px]" />
                    <div className="flex items-center gap-1">
                      <s.Icon size={14} style={{ color: s.color }} />
                      <CountUpNumber value={pct} formatter={n => `${n}%`} className="text-base font-semibold" style={{ color: s.color }} />
                      <span className="text-xs text-ink-muted">of {kpis.length || 0}</span>
                    </div>
                    <div className="text-xs text-ink-muted mt-1">{s.caption}</div>
                  </div>
                )
              })}
            </div>

            <CrossfadeSwap
              show={!loading}
              skeleton={
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-panel border border-divider rounded-3xl animate-pulse" />)}
                </div>
              }
            >
              <Tabs value={view} onValueChange={v => v && setView(v as 'charts' | 'table')}>
                <TabsList variant="pill" className="mb-4 w-full sm:w-fit">
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
                  {/* One at-a-glance overview card for the whole department — small-multiples grid of
                      compact trend sparklines, one per KPI, each on its own scale (see
                      KpiSparklineGrid for why: unit incompatibility rules out one combined chart).
                      Shared with Corporate Planning's own per-department drill-down on the board page,
                      so both sides see the same at-a-glance trend view instead of CorPlan only ever
                      seeing status categories with no shape behind them. The full-size versions of
                      these same charts are the per-KPI cards further below. */}
                  {kpisWithData.length > 0 && (
                    <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="font-medium text-ink text-sm">{user.dept_name} KPI Status</h3>
                        <Badge variant="outline" className="h-auto px-2 py-0.5 text-[10px]">{rangeLabel}</Badge>
                      </div>
                      <div className="-mx-5 border-t border-divider mb-4" />
                      <KpiSparklineGrid
                        items={kpisWithData.map(({ kpi, unit, monthValues, hasData, currentV }) => ({
                          id: kpi.id, name: kpi.name, unit, monthValues, hasData, currentV,
                        }))}
                      />
                    </div>
                  )}

                  {kpisWithData.map(({ kpi, unit, monthValues, hasData, currentV, period }) => {
                    const chartConfig: ChartConfig = { value: { label: kpi.name, color: CHART_COLOR } }
                    return (
                      <div key={kpi.id} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
                        <div className="px-6 pt-4 pb-3 flex items-start justify-between gap-4">
                          <div>
                            {/* Small screens only: frequency reads above the title, not below it. */}
                            <div className="flex flex-col-reverse items-start gap-1 md:flex-row md:items-center md:gap-2">
                              <span className="font-medium text-ink text-sm">{kpi.name}</span>
                              <span className="inline-flex items-center border border-divider bg-panel-soft text-ink-muted px-2.5 py-1 text-xs rounded font-medium tracking-wide">
                                {periodLabel(period)}
                              </span>
                            </div>
                            <div className="text-ink-muted text-xs mt-0.5 font-normal">Target: {kpi.target_text}</div>
                          </div>
                          {currentV !== null && (
                            <div className="text-right shrink-0">
                              <div className="text-2xl font-semibold text-ink tracking-tight">{formatValue(currentV, unit)}</div>
                              <div className="text-[10px] text-ink-muted">{MONTHS[rangeTo.month - 1]}{isMultiYear ? ` ${rangeTo.year}` : ''}</div>
                            </div>
                          )}
                        </div>

                        {/* Always rendered, even with zero entries — the axis alone (Jan..Dec of the
                            selected range) already tells the user what period they're looking at.
                            Hiding the chart entirely whenever no values existed yet read as "nothing
                            is here" rather than "here's the range, no data yet" — the caption below
                            makes the empty state explicit instead of leaving a blank card. */}
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
                                    // Status only shows up here, on hover — not as a permanent dot
                                    // table, which would just be re-stating the same on/off-track
                                    // verdict the Table tab's KPI Breakdown already carries in text.
                                    formatter={(value, _name, _item, _index, payload) => {
                                      const status = (payload as { status?: KpiStatus } | undefined)?.status
                                      return [
                                        unit === '%' ? `${value}%` : `${value}`,
                                        kpi.name,
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
                                fill={`url(#grad-${kpi.id})`}
                                connectNulls={false}
                                dot={false}
                                activeDot={{ r: 3, fill: CHART_COLOR }}
                              />
                            </AreaChart>
                          </ChartContainer>
                        </div>
                        {!hasData && (
                          <div className="px-5 pb-4 -mt-1 text-xs text-ink-faint">No data entered yet for {rangeLabel}.</div>
                        )}
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
                        {rangePeriods.map((p, i) => (
                          <div key={`${p.year}-${p.month}`} className="flex items-center justify-between border-t border-divider">
                            <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">{MONTHS[p.month - 1]}{isMultiYear ? ` ${p.year}` : ''}</span>
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
                          <TableHead className="sticky left-0 bg-panel max-w-[240px]">KPI</TableHead>
                          {rangePeriods.map(p => (
                            <TableHead key={`${p.year}-${p.month}`} className="text-right whitespace-nowrap">
                              {MONTHS[p.month - 1].slice(0, 3)}{isMultiYear ? ` '${String(p.year).slice(2)}` : ''}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {kpisWithData.map(({ kpi, unit, monthValues, period }) => (
                          <TableRow key={kpi.id}>
                            <TableCell className="sticky left-0 bg-panel font-medium text-ink max-w-[240px]">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate" title={kpi.name}>{kpi.name}</span>
                                <span className="shrink-0 inline-flex items-center border border-divider bg-panel-soft text-ink-muted px-2.5 py-1 text-xs rounded font-medium tracking-wide">
                                  {periodLabel(period)}
                                </span>
                              </div>
                              <div className="text-xs text-ink-muted font-normal mt-0.5 truncate" title={`Target: ${kpi.target_text}`}>Target: {kpi.target_text}</div>
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
            </CrossfadeSwap>
          </div>
        </main>
        </div>

        {/* Right: add-ons */}
        <AnimatedAside open={rightPanelOpen} width={400} side="right" className="absolute inset-y-0 right-0 z-10 hidden lg:block" contentClassName="overflow-y-auto">
          <AddOnsPanel />
        </AnimatedAside>
      </div>
    </div>
  )
}
