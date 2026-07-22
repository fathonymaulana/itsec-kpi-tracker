'use client'
import { useState, useEffect, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import {
  AltArrowDownLineDuotone as ChevronDown,
  AltArrowUpLineDuotone as ChevronUp,
  GraphNewUpLineDuotone as TrendingUp,
  GraphDownNewLineDuotone as TrendingDown,
  MinusCircleLineDuotone as Minus,
  ClipboardCheckLineDuotone as FileSearch,
  ChartLineDuotone as ChartLine, ChartBold as ChartBold,
  ListLineDuotone as ListLine, ListBold as ListBold,
  TuningLineDuotone as IconFilters,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { AnimatedAside } from '@/components/layout/AnimatedAside'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { useResponsivePanels } from '@/hooks/use-responsive-panels'
import type { MonthPeriod } from '@/components/kpi/DateSidebar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { getStatus, worstStatus, MONTHS, getDefaultMonth, getDefaultYear, type KpiStatus } from '@/lib/status'
import { getPeriodStatuses, resolvePrimaryValue, type SubMetricLike } from '@/lib/kpi-primary'
import { StatusBadge } from '@/components/kpi/StatusBadge'
import { KpiStatusGrid, formatKpiValue } from '@/components/kpi/KpiStatusGrid'
import { parsePeriod, periodLabel as frequencyLabel } from '@/lib/frequency'
import { DownloadReportButton } from '@/components/ui/download-report-button'
import { CountUpNumber } from '@/components/ui/animated-number'
import { CrossfadeSwap } from '@/components/ui/crossfade-swap'
import { MobileDatePicker } from '@/components/kpi/MobileDatePicker'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn, iconHoverClass } from '@/lib/utils'

const CURRENT_YEAR = new Date().getFullYear()

interface PeriodTally {
  year: number
  month: number
  on_track: number
  watch: number
  off_track: number
  no_data: number
  review_manually: number
}

interface DeptSummary {
  dept_id: string
  department_name: string
  total: number
  on_track: number
  watch: number
  off_track: number
  no_data: number
  month_statuses: Partial<Record<number, KpiStatus>>
  periods?: PeriodTally[]
}

interface DeptKpiSummary {
  id: number
  name: string
  target_text: string
  status: KpiStatus
  unit: string
  frequency: string | null
  monthValues: { month: string; value: number | null; raw: number | null }[]
  hasData: boolean
  currentV: number | null
  // Status-card fields (KpiStatusGrid) — currentStatus is the LATEST period's status specifically,
  // distinct from `status` above (the worst status across detailPeriods, used by the accordion's
  // StatusBadge list). target/direction come from the primary sub-metric, not a KPI-level field —
  // see the comment where these are computed for why.
  currentStatus: KpiStatus
  target: number | null
  direction: number
  pctOfTarget: number | null
  deltaRaw: number | null
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

export default function BoardPage() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [summaries, setSummaries] = useState<DeptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [deptKpiDetails, setDeptKpiDetails] = useState<Record<string, DeptKpiSummary[]>>({})
  const [loadingDeptDetails, setLoadingDeptDetails] = useState<Set<string>>(new Set())
  const { leftPanelOpen, rightPanelOpen, toggleLeftPanel, toggleRightPanel } = useResponsivePanels()
  const [view, setView] = useState<'charts' | 'table'>('charts')
  // Membership = hidden, not shown — starts empty (nothing hidden, every department visible) so
  // this doesn't need to know the full department list before the first fetch resolves.
  const [hiddenDepts, setHiddenDepts] = useState<Set<string>>(new Set())
  // null = the "All" tab (worst-status-across-the-range aggregate, the default/original behavior).
  // Set to a specific period once the range spans more than one month and the user picks one of the
  // per-month tabs under Department Breakdown, to drill into just that month instead of the rollup.
  const [breakdownPeriod, setBreakdownPeriod] = useState<MonthPeriod | null>(null)

  // The single date control for this whole page now — CorPlan's sidebar picker (see DateSidebar's
  // range mode). Defaults to a one-month "range" (today's default period, both ends the same) so a
  // fresh page load reads exactly like the old single-month dashboard; widening the range is what
  // switches the stat cards/chart into an aggregate-across-the-range view. The Table tab's full-year
  // breakdown reads the same rangeFrom/rangeTo — no separate picker for it anymore.
  const [rangeFrom, setRangeFrom] = useState<MonthPeriod>({ year: getDefaultYear(), month: getDefaultMonth() })
  const [rangeTo, setRangeTo] = useState<MonthPeriod>({ year: getDefaultYear(), month: getDefaultMonth() })
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
      // no department's figures ever blend into another's here or in the table/chart below. Each
      // KPI counts once, as its worst status across every period in the range (on_track/watch/
      // off_track/no_data tallies reflect that "worst wins" rule, not a raw per-month sum).
      const sumRes = await fetch(
        `/api/board/summary/${rangeFrom.year}?fromMonth=${rangeFrom.month}&toYear=${rangeTo.year}&toMonth=${rangeTo.month}`,
        { headers: authHeaders(token) }
      )
      const sumData = await sumRes.json()
      setSummaries(sumData.departments || [])
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [user, token, rangeFrom.year, rangeFrom.month, rangeTo.year, rangeTo.month])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  // A previously-picked month tab may not even fall inside a newly-picked range, and any cached
  // per-KPI detail was computed for the old range/tab anyway — reset both back to "All" + empty so
  // nothing stale carries over when the range itself changes.
  useEffect(() => { setBreakdownPeriod(null); setDeptKpiDetails({}) }, [rangeFrom.year, rangeFrom.month, rangeTo.year, rangeTo.month])

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
  const isMultiYear = rangeFrom.year !== rangeTo.year

  // Lazy-loaded on first expand — the board summary endpoint only carries aggregate counts, not KPI
  // names/targets, so seeing the actual per-KPI breakdown for one department means a real fetch.
  // When a specific month tab is active (breakdownPeriod set), each KPI's status is just that one
  // period's — same rule the collapsed badge counts use via tallyFor. On "All", falls back to the
  // worst status across every period in rangePeriods, matching the range-wide aggregate. The trend
  // sparkline data (monthValues) always covers the FULL rangePeriods regardless of which tab is
  // active though — narrowing it to a single month's worth of data would make a one-point "trend"
  // useless, and it's the same sparkline grid dept_head sees on their own dashboard for the whole
  // selected range, tab selection aside.
  const detailPeriods = breakdownPeriod ? [breakdownPeriod] : rangePeriods
  const fetchDeptKpiDetails = useCallback(async (deptId: string) => {
    if (!token || deptKpiDetails[deptId] || loadingDeptDetails.has(deptId)) return
    setLoadingDeptDetails(prev => new Set(prev).add(deptId))
    try {
      const years = Array.from(new Set(rangePeriods.map(p => p.year)))
      const [kpiRes, ...actResList] = await Promise.all([
        fetch(`/api/departments/${deptId}/kpis`, { headers: authHeaders(token) }),
        ...years.map(y => fetch(`/api/actuals?dept_id=${deptId}&year=${y}`, { headers: authHeaders(token) })),
      ])
      const kpiData = await kpiRes.json()
      const actualsByYearMonth: Record<number, Record<number, Record<number, number>>> = {}
      for (let i = 0; i < years.length; i++) {
        const actData = await actResList[i].json()
        const y = years[i]
        actualsByYearMonth[y] = {}
        for (const a of (actData.actuals || [])) {
          if (!actualsByYearMonth[y][a.month]) actualsByYearMonth[y][a.month] = {}
          actualsByYearMonth[y][a.month][a.sub_metric_id] = a.value
        }
      }
      interface KpiRow {
        id: number; name: string; target_text: string; numeric_target: number | null; direction: number
        frequency?: string | null; sub_metrics: (SubMetricLike & { unit: string })[]
      }
      const summariesForDept: DeptKpiSummary[] = (kpiData.kpis || []).map((kpi: KpiRow) => {
        const statuses = detailPeriods.map(p => {
          const actualsByMonth = actualsByYearMonth[p.year] || {}
          const { overall } = getPeriodStatuses(kpi.sub_metrics, actualsByMonth, kpi.frequency, p.month)
          return overall ?? getStatus(resolvePrimaryValue(kpi.sub_metrics, actualsByMonth[p.month] || {}), kpi.numeric_target, kpi.direction)
        })
        const primary = kpi.sub_metrics.find(sm => sm.is_calculated) ?? kpi.sub_metrics[0]
        const unit = primary?.unit || ''
        const monthValues = rangePeriods.map(p => {
          const actualsByMonth = actualsByYearMonth[p.year] || {}
          const vals = actualsByMonth[p.month] || {}
          const v = resolvePrimaryValue(kpi.sub_metrics, vals)
          const displayValue = v !== null
            ? unit === '%' ? parseFloat((v * 100).toFixed(1)) : parseFloat(v.toFixed(2))
            : null
          const label = isMultiYear ? `${MONTHS[p.month - 1].slice(0, 3)} '${String(p.year).slice(2)}` : MONTHS[p.month - 1].slice(0, 3)
          return { month: label, value: displayValue, raw: v }
        })
        const hasData = monthValues.some(d => d.value !== null)
        const currentV = resolvePrimaryValue(kpi.sub_metrics, actualsByYearMonth[rangeTo.year]?.[rangeTo.month] || {})
        // Status-card fields — target/direction come from the primary sub-metric (kpi.numeric_target/
        // direction are stale for KPIs with multiple independently-targeted components), and
        // currentStatus is specifically the latest period's status, not the detailPeriods-worst
        // `status` above (which stays as-is for the accordion's StatusBadge list further down).
        const target = primary?.numeric_target ?? null
        const direction = primary?.direction ?? 1
        const { overall: currentOverall } = getPeriodStatuses(kpi.sub_metrics, actualsByYearMonth[rangeTo.year] || {}, kpi.frequency, rangeTo.month)
        const currentStatus = currentOverall ?? getStatus(currentV, target, direction)
        const pctOfTarget = (currentV !== null && target) ? (currentV / target) * 100 : null
        const previousV = monthValues.length >= 2 ? monthValues[monthValues.length - 2].raw : null
        const deltaRaw = (currentV !== null && previousV !== null) ? currentV - previousV : null
        return {
          id: kpi.id, name: kpi.name, target_text: kpi.target_text, status: worstStatus(statuses), unit,
          frequency: kpi.frequency ?? null, monthValues, hasData, currentV,
          currentStatus, target, direction, pctOfTarget, deltaRaw,
        }
      })
      setDeptKpiDetails(prev => ({ ...prev, [deptId]: summariesForDept }))
    } catch { /* non-fatal */ }
    finally {
      setLoadingDeptDetails(prev => { const next = new Set(prev); next.delete(deptId); return next })
    }
    // detailPeriods/rangePeriods/isMultiYear are derived fresh each render — depend on their own
    // inputs directly rather than the derived values themselves, which would never be referentially
    // stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rangeFrom.year, rangeFrom.month, rangeTo.year, rangeTo.month, breakdownPeriod, deptKpiDetails, loadingDeptDetails])

  // Switching tabs invalidates any already-fetched per-KPI detail (it was computed for the previous
  // tab's period set) so re-expanding a department fetches fresh, correct-for-the-new-tab data
  // instead of silently showing stale statuses.
  useEffect(() => { setDeptKpiDetails({}) }, [breakdownPeriod])

  // The org-wide KPI Breakdown table (replacing the old department-status bar chart) needs every
  // department's per-KPI detail up front, not just the one a user happens to expand below — fetch
  // them all as soon as the department list loads. fetchDeptKpiDetails already no-ops for any dept_id
  // that's cached or mid-fetch, so this is safe to re-run whenever `summaries` changes (a new array
  // reference on every refetch, even when the content is identical) without duplicating requests.
  useEffect(() => {
    if (!token || summaries.length === 0) return
    summaries.forEach(d => fetchDeptKpiDetails(d.dept_id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, summaries])

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) }
      else { next.add(id); fetchDeptKpiDetails(id) }
      return next
    })
  }

  if (!ready || !user) return <PageSkeleton />

  // The department filter applies everywhere summaries feeds the page — stat cards, chart,
  // accordion, both table views, and the exported report all read this instead of the raw fetch
  // result, so hiding a department is consistent across the whole dashboard, not just one chart.
  const filteredSummaries = summaries.filter(d => !hiddenDepts.has(d.dept_id))

  // Department Breakdown's own tally — stat cards/chart above always stay the range-wide aggregate
  // (on_track/watch/off_track/no_data), but the breakdown accordion switches to one specific
  // period's counts when a month tab is active instead of the "worst across the range" rollup.
  const tallyFor = (dept: DeptSummary) => {
    if (!breakdownPeriod) return { on_track: dept.on_track, watch: dept.watch, off_track: dept.off_track, no_data: dept.no_data }
    const p = dept.periods?.find(p => p.year === breakdownPeriod.year && p.month === breakdownPeriod.month)
    return p ?? { on_track: 0, watch: 0, off_track: 0, no_data: dept.total }
  }

  // Totals across filtered depts
  const totals = filteredSummaries.reduce((acc, d) => ({
    total: acc.total + d.total,
    on_track: acc.on_track + d.on_track,
    watch: acc.watch + d.watch,
    off_track: acc.off_track + d.off_track,
    no_data: acc.no_data + d.no_data,
  }), { total: 0, on_track: 0, watch: 0, off_track: 0, no_data: 0 })

  const pct = (n: number) => totals.total > 0 ? Math.round(n / totals.total * 100) : 0

  const periodLabel = (p: MonthPeriod) => `${MONTHS[p.month - 1]} ${p.year}`
  const isSinglePeriod = rangeFrom.year === rangeTo.year && rangeFrom.month === rangeTo.month
  const rangeLabel = isSinglePeriod ? periodLabel(rangeFrom) : `${periodLabel(rangeFrom)} – ${periodLabel(rangeTo)}`

  return (
    <div className="h-screen flex flex-col bg-app overflow-hidden">
      <DeptTopNav
        leftPanelOpen={leftPanelOpen}
        onToggleLeftPanel={toggleLeftPanel}
        rightPanelOpen={rightPanelOpen}
        onToggleRightPanel={toggleRightPanel}
      />

      {/* The scroll container spans edge-to-edge (both asides float above it, absolutely
          positioned) so its native scrollbar renders at the true right edge of the viewport. */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatedAside open={leftPanelOpen} width={350} side="left" className="absolute inset-y-0 left-0 z-10 hidden md:block" contentClassName="py-8 px-6 overflow-y-auto">
          <DateSidebar
            year={rangeFrom.year}
            onYearChange={() => {}}
            month={rangeFrom.month}
            toYear={rangeTo.year}
            toMonth={rangeTo.month}
            onRangeChange={(f, t) => { setRangeFrom(f); setRangeTo(t) }}
            minYear={CURRENT_YEAR - 2}
            maxYear={CURRENT_YEAR + 1}
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
          <div className="max-w-5xl mx-auto">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Dashboard</h1>
                <p className="text-sm text-ink-muted mt-1">
                  Every department&apos;s KPI status for {rangeLabel}, at a glance.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'shadow-xs', iconHoverClass)}>
                  <IconFilters size={15} />
                  Departments
                  {hiddenDepts.size > 0 && <Badge className="ml-0.5 text-[10px] px-1.5">{summaries.length - hiddenDepts.size}/{summaries.length}</Badge>}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
                  <DropdownMenuCheckboxItem
                    checked={hiddenDepts.size === 0}
                    onCheckedChange={v => setHiddenDepts(v ? new Set() : new Set(summaries.map(d => d.dept_id)))}
                    className="font-medium"
                  >
                    Select All
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {summaries.map(d => (
                    <DropdownMenuCheckboxItem
                      key={d.dept_id}
                      checked={!hiddenDepts.has(d.dept_id)}
                      onCheckedChange={v => setHiddenDepts(prev => {
                        const next = new Set(prev)
                        if (v) next.delete(d.dept_id); else next.add(d.dept_id)
                        return next
                      })}
                    >
                      {d.department_name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DownloadReportButton
                title={`Department KPI Status — ${rangeLabel}`}
                filename={`department-kpi-status-${rangeFrom.year}-${String(rangeFrom.month).padStart(2, '0')}${isSinglePeriod ? '' : `-to-${rangeTo.year}-${String(rangeTo.month).padStart(2, '0')}`}`}
                columns={[
                  { key: 'department_name', label: 'Department', width: 28 },
                  { key: 'total', label: 'Total KPIs' },
                  { key: 'on_track', label: 'On Track' },
                  { key: 'watch', label: 'Watch' },
                  { key: 'off_track', label: 'Off Track' },
                  { key: 'no_data', label: 'No Data' },
                ]}
                rows={filteredSummaries.map(d => ({
                  department_name: d.department_name,
                  total: d.total,
                  on_track: d.on_track,
                  watch: d.watch,
                  off_track: d.off_track,
                  no_data: d.no_data,
                }))}
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
              minYear={CURRENT_YEAR - 2}
              maxYear={CURRENT_YEAR + 1}
              className="mb-6"
            />

            {/* Summary stat cards — same layout/sizing as the dept_head dashboard's stat cards
                (app/dept/dashboard/page.tsx), so this reads identically across roles. */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'On Track', variant: 'success' as const, value: totals.on_track, pct: pct(totals.on_track), color: 'var(--success-text)', Icon: TrendingUp, caption: 'performing at or above target' },
                { label: 'Watch', variant: 'warning' as const, value: totals.watch, pct: pct(totals.watch), color: 'var(--warning-text)', Icon: Minus, caption: 'trending toward target, worth watching' },
                { label: 'Off Track', variant: 'danger' as const, value: totals.off_track, pct: pct(totals.off_track), color: 'var(--danger-text)', Icon: Minus, caption: 'below target — needs attention' },
                { label: 'No Data', variant: 'outline' as const, value: totals.no_data, pct: pct(totals.no_data), color: 'var(--ink-muted)', Icon: Minus, caption: 'not yet entered this period' },
              ].map(s => (
                <div key={s.label} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-6 flex flex-col gap-1.5">
                  <Badge variant={s.variant} className="h-auto px-2 py-0.5 text-[10px] w-fit">{s.label}</Badge>
                  <CountUpNumber value={s.value} className="text-[40px] leading-[48px] font-medium text-ink tracking-[-0.5px]" />
                  <div className="flex items-center gap-1">
                    <s.Icon size={14} style={{ color: s.color }} />
                    <CountUpNumber value={s.pct} formatter={n => `${n}%`} className="text-base font-semibold" style={{ color: s.color }} />
                    <span className="text-xs text-ink-muted">of {totals.total || 0}</span>
                  </div>
                  <div className="text-xs text-ink-muted mt-1">{s.caption}</div>
                </div>
              ))}
            </div>

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

              <TabsContent value="charts">
                {/* Same per-KPI status cards as the dept_head's own dashboard — one grid per
                    department, so CorPlan can scan every department's "who needs attention right now"
                    without leaving the board page. Each department's data loads independently
                    (loadingDeptDetails, same fetch the accordion below already used) so cards fill in
                    progressively instead of blocking on all 12 departments' fetches at once. */}
                {!loading && filteredSummaries.length > 0 && (
                  <div className="space-y-4 mb-6">
                    {filteredSummaries.map(dept => (
                      <div key={dept.dept_id} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl p-5">
                        <div className="flex items-center justify-between gap-2 mb-4">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-ink text-sm">{dept.department_name}</h3>
                            <Badge variant="outline" className="h-auto px-2 py-0.5 text-[10px]">{rangeLabel}</Badge>
                          </div>
                          <span className="text-xs text-ink-muted shrink-0">{dept.total} KPI{dept.total !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="-mx-5 border-t border-divider mb-4" />
                        {deptKpiDetails[dept.dept_id] ? (
                          <KpiStatusGrid items={deptKpiDetails[dept.dept_id]} TrendUpIcon={TrendingUp} TrendDownIcon={TrendingDown} />
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[...Array(2)].map((_, i) => <div key={i} className="h-32 bg-panel-soft rounded-2xl animate-pulse" />)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Department accordion */}
                <div className="space-y-2">
                  <h3 className="font-medium text-ink text-sm mb-3">Department Breakdown</h3>

                  {/* Only worth showing once the range actually spans more than one month — "All"
                      (the range-wide worst-status aggregate, same as the stat cards/chart above) is
                      always first, then one tab per month in the range to drill into just that
                      month instead of the rollup. */}
                  {rangePeriods.length > 1 && (
                    <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-hide">
                      <button
                        onClick={() => setBreakdownPeriod(null)}
                        className={cn(
                          'shrink-0 h-8 px-3 rounded-full text-xs font-medium transition-colors',
                          !breakdownPeriod ? 'bg-primary text-primary-foreground' : 'bg-panel border border-divider text-ink-muted hover:text-ink'
                        )}
                      >
                        All
                      </button>
                      {rangePeriods.map(p => {
                        const active = breakdownPeriod?.year === p.year && breakdownPeriod?.month === p.month
                        return (
                          <button
                            key={`${p.year}-${p.month}`}
                            onClick={() => setBreakdownPeriod(p)}
                            className={cn(
                              'shrink-0 h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                              active ? 'bg-primary text-primary-foreground' : 'bg-panel border border-divider text-ink-muted hover:text-ink'
                            )}
                          >
                            {MONTHS[p.month - 1].slice(0, 3)} {p.year}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <CrossfadeSwap
                    show={!loading}
                    skeleton={
                      <div className="space-y-2">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-panel border border-divider rounded-3xl animate-pulse" />)}
                      </div>
                    }
                  >
                  <div className="space-y-2">
                  {filteredSummaries.map(dept => {
                    const expanded = expandedDepts.has(dept.dept_id)
                    const tally = tallyFor(dept)
                    const onPct = dept.total > 0 ? Math.round(tally.on_track / dept.total * 100) : 0
                    return (
                      <div key={dept.dept_id} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden">
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
                                { v: tally.on_track, c: 'var(--success-text)', bg: 'var(--success-soft-bg)' },
                                { v: tally.watch, c: 'var(--warning-text)', bg: 'var(--warning-soft-bg)' },
                                { v: tally.off_track, c: 'var(--danger-text)', bg: 'var(--danger-soft-bg)' },
                                { v: tally.no_data, c: 'var(--ink-faint)', bg: 'var(--panel-soft-bg)' },
                              ].map((s, i) => s.v > 0 && (
                                <Badge key={i} className="size-5 shrink-0 p-0 justify-center rounded-full text-[10px] font-medium" style={{ color: s.c, background: s.bg }}>
                                  {s.v}
                                </Badge>
                              ))}
                            </div>
                            {expanded ? <ChevronUp size={14} className="text-ink-faint" /> : <ChevronDown size={14} className="text-ink-faint" />}
                          </div>
                        </button>
                        {expanded && (
                          <div className="border-t border-divider px-5 py-3 space-y-3">
                            {loadingDeptDetails.has(dept.dept_id) ? (
                              <div className="space-y-1.5">
                                {[...Array(3)].map((_, i) => <div key={i} className="h-8 bg-panel-soft rounded-lg animate-pulse" />)}
                              </div>
                            ) : deptKpiDetails[dept.dept_id] && (
                              // One row per KPI with its own StatusBadge — a badge already carries
                              // color, a status dot, AND a readable label in one compact element.
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
                              className={cn('text-destructive', iconHoverClass)}
                            >
                              <FileSearch />
                              View KPI details & sources
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  </div>
                  </CrossfadeSwap>
                </div>
              </TabsContent>

              <TabsContent value="table">
                {/* KPI Breakdown — every department's every KPI, actual values per month, grouped by
                    department. Leads the tab since it's the most-used, most-detailed view here — the
                    same detail a dept_head already sees on their own dashboard's Table tab, for every
                    department at once, instead of having to open Data Review one department at a time
                    to see an actual number. First column is deliberately narrow (name truncates, target
                    and frequency drop to a tooltip-only title) — the point of this table is the monthly
                    values, so they get the horizontal room instead of the label. */}
                {!loading && filteredSummaries.length > 0 && (
                  <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl p-5 mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <h3 className="font-medium text-ink text-sm">KPI Breakdown — All Departments</h3>
                      <Badge variant="outline" className="h-auto px-2 py-0.5 text-[10px]">{rangeLabel}</Badge>
                    </div>
                    <div className="-mx-5 border-t border-divider mb-4" />
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-panel w-[130px] max-w-[130px]">KPI</TableHead>
                            {rangePeriods.map(p => (
                              <TableHead key={`${p.year}-${p.month}`} className="text-right whitespace-nowrap">
                                {MONTHS[p.month - 1].slice(0, 3)}{isMultiYear ? ` '${String(p.year).slice(2)}` : ''}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSummaries.map(dept => (
                            <Fragment key={dept.dept_id}>
                              <TableRow className="bg-panel-soft hover:bg-panel-soft">
                                <TableCell colSpan={rangePeriods.length + 1} className="sticky left-0 bg-panel-soft font-semibold text-ink text-xs py-2">
                                  {dept.department_name}
                                </TableCell>
                              </TableRow>
                              {deptKpiDetails[dept.dept_id] ? (
                                deptKpiDetails[dept.dept_id].map(k => (
                                  <TableRow key={k.id}>
                                    <TableCell
                                      className="sticky left-0 bg-panel font-medium text-ink w-[130px] max-w-[130px] truncate text-xs"
                                      title={`${k.name}${k.frequency ? ` — ${frequencyLabel(parsePeriod(k.frequency))}` : ''} — Target: ${k.target_text}`}
                                    >
                                      {k.name}
                                    </TableCell>
                                    {k.monthValues.map((mv, i) => (
                                      <TableCell key={i} className="text-right text-ink whitespace-nowrap text-sm">
                                        {formatKpiValue(mv.raw, k.unit)}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={rangePeriods.length + 1} className="sticky left-0 bg-panel">
                                    <div className="h-8 bg-panel-soft rounded-lg animate-pulse my-1" />
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Mobile/tablet: one card per department, matching the Figma "Table Card
                    Responsive" component exactly — a muted header (label + value, View details
                    button), one divided label/value row per metric, and a footer stat. Replaces
                    the earlier 4-up colored-badge grid with this row-based layout. */}
                <div className="flex md:hidden flex-col gap-3 mb-6">
                  {filteredSummaries.map(dept => {
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
                            className={cn('text-destructive', iconHoverClass)}
                          >
                            <FileSearch />
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
                        <TableHead className="max-w-[180px]">Department</TableHead>
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
                      {filteredSummaries.map(dept => {
                        const onPct = dept.total > 0 ? Math.round(dept.on_track / dept.total * 100) : 0
                        return (
                          <TableRow key={dept.dept_id}>
                            <TableCell className="font-medium text-ink max-w-[180px] truncate" title={dept.department_name}>{dept.department_name}</TableCell>
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
                                className={cn('text-destructive', iconHoverClass)}
                              >
                                <FileSearch />
                                View details & sources
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Every month in the range picked in the sidebar, per department — that's the one
                    date control for the whole page now, so this just reflects the current selection
                    rather than offering its own separate picker. */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h3 className="font-medium text-ink text-sm">Full Period Overview</h3>
                  <Badge variant="outline" className="h-auto px-2 py-0.5 text-[10px]">{rangeLabel}</Badge>
                </div>
                {/* Mobile/tablet: one card per department, matching the Figma "Table Card
                    Responsive" pattern used everywhere else — muted header (department name),
                    one divided label/value row per period with a status dot instead of text. */}
                <div className="flex md:hidden flex-col gap-3">
                  {filteredSummaries.map(dept => (
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
                        <TableHead className="sticky left-0 bg-panel max-w-[180px]">Department</TableHead>
                        {rangePeriods.map(p => (
                          <TableHead key={`${p.year}-${p.month}`} className="text-center whitespace-nowrap">
                            {MONTHS[p.month - 1].slice(0, 3)} {p.year !== rangePeriods[0].year || p.year !== rangePeriods[rangePeriods.length - 1].year ? String(p.year).slice(2) : ''}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSummaries.map(dept => (
                        <TableRow key={dept.dept_id}>
                          <TableCell className="font-medium text-ink sticky left-0 bg-panel max-w-[180px] truncate" title={dept.department_name}>{dept.department_name}</TableCell>
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
        </div>

        <AnimatedAside open={rightPanelOpen} width={400} side="right" className="absolute inset-y-0 right-0 z-10 hidden lg:block" contentClassName="overflow-y-auto">
          <AddOnsPanel />
        </AnimatedAside>
      </div>
    </div>
  )
}
