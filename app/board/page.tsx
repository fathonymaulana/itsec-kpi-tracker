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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { AnimatedAside } from '@/components/layout/AnimatedAside'
import { MonthGrid } from '@/components/kpi/MonthGrid'
import { MonthRangePicker, type MonthPeriod } from '@/components/kpi/MonthRangePicker'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart'
import { MONTHS, getDefaultMonth, getDefaultYear, type KpiStatus } from '@/lib/status'

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

export default function BoardPage() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [month, setMonth] = useState(getDefaultMonth())
  const [year, setYear] = useState(getDefaultYear())
  const [summaries, setSummaries] = useState<DeptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
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

  if (!ready || !user) return null

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

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
        <AnimatedAside open={leftPanelOpen} width={350} side="left" className="hidden md:block p-12 overflow-y-auto">
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
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Dashboard</h1>
              <p className="text-sm text-ink-muted mt-1">
                Every department&apos;s KPI status for {MONTHS[month - 1]} {year}, at a glance.
              </p>
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
              <TabsList className="mb-4">
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
                    <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto">
                      <BarChart data={chartData} layout="vertical" barSize={18} barCategoryGap="30%" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="var(--divider)" />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--ink-faint)' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} tickLine={false} axisLine={false} width={84} />
                        <ChartTooltip cursor={{ fill: 'var(--panel-soft-bg)' }} content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="onTrack" stackId="a" fill="var(--color-onTrack)" radius={[3, 3, 3, 3]} />
                        <Bar dataKey="watch" stackId="a" fill="var(--color-watch)" radius={[3, 3, 3, 3]} />
                        <Bar dataKey="offTrack" stackId="a" fill="var(--color-offTrack)" radius={[3, 3, 3, 3]} />
                        <Bar dataKey="noData" stackId="a" fill="var(--color-noData)" radius={[3, 3, 3, 3]} />
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
                                <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: s.c, background: s.bg }}>
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
                            <button
                              onClick={() => router.push(`/admin?dept=${dept.dept_id}`)}
                              className="flex items-center gap-1.5 text-[11px] text-[#CC1F1F] hover:text-[#8B1A1A] transition-colors"
                            >
                              <FileSearch size={11} />
                              View KPI details & sources
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </TabsContent>

              <TabsContent value="table">
                <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden mb-6">
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
                <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
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

        <AnimatedAside open={rightPanelOpen} width={400} side="right" className="hidden lg:block overflow-y-auto">
          <AddOnsPanel />
        </AnimatedAside>
      </div>
    </div>
  )
}
