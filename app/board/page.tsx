'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DangerTriangleLineDuotone as AlertTriangle,
  AltArrowDownLineDuotone as ChevronDown,
  AltArrowUpLineDuotone as ChevronUp,
  GraphNewUpLineDuotone as TrendingUp,
  MinusCircleLineDuotone as Minus,
  ClipboardCheckLineDuotone as FileSearch,
} from '@solar-icons/react-perf'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { MonthGrid } from '@/components/kpi/MonthGrid'
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

interface AnomalyItem {
  dept_id: string
  department_name: string
  kpi_name: string
  type: string
  description: string
  created_at: string
}

// Status colors are semantic (green/amber/red/gray for on-track/watch/off-track/no-data) and stay
// distinct from the app's default black chart color, which is reserved for single-series trend charts.
const STATUS_COLORS = {
  on_track: '#22C55E',
  watch: '#F59E0B',
  off_track: '#EF4444',
  no_data: '#D1D5DB',
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
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [showAnomalies, setShowAnomalies] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [view, setView] = useState<'charts' | 'table'>('charts')

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
      const [sumRes, anoRes] = await Promise.all([
        fetch(`/api/board/summary/${year}?month=${month}`, { headers: authHeaders(token) }),
        fetch(`/api/board/anomalies?year=${year}&month=${month}`, { headers: authHeaders(token) }),
      ])
      const sumData = await sumRes.json()
      const anoData = await anoRes.json()
      setSummaries(sumData.departments || [])
      setAnomalies((anoData.anomalies || []).filter((a: AnomalyItem & { dismissed: number }) => !a.dismissed))
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [user, token, year, month])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

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
        {leftPanelOpen && (
          <aside className="hidden md:block w-[350px] shrink-0 p-12 overflow-y-auto">
            <DateSidebar
              year={year}
              onYearChange={setYear}
              month={month}
              onMonthChange={setMonth}
              minYear={CURRENT_YEAR - 1}
              maxYear={CURRENT_YEAR + 1}
            />
          </aside>
        )}

        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Dashboard</h1>
              <p className="text-sm text-ink-muted mt-1">
                Every department&apos;s KPI status for {MONTHS[month - 1]} {year}, at a glance.
              </p>
            </div>

            {/* Anomaly alert */}
            {anomalies.length > 0 && (
              <button
                onClick={() => setShowAnomalies(s => !s)}
                className="w-full mb-6 flex items-center gap-3 bg-warning-soft border border-warning-soft-border px-4 py-3 rounded-2xl text-left hover:bg-[#FFF3CC] transition-colors"
              >
                <AlertTriangle size={15} className="text-warning shrink-0" />
                <span className="text-sm font-medium text-warning flex-1">
                  {anomalies.length} unresolved anomaly{anomalies.length > 1 ? 'ies' : ''} across departments
                </span>
                {showAnomalies ? <ChevronUp size={14} className="text-warning" /> : <ChevronDown size={14} className="text-warning" />}
              </button>
            )}

            {showAnomalies && (
              <div className="mb-6 bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
                {anomalies.map((a, i) => (
                  <div key={i} className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? 'border-t border-divider' : ''}`}>
                    <AlertTriangle size={13} className="text-[#F59E0B] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-medium text-ink">{a.department_name} — {a.kpi_name}</div>
                      <div className="text-xs text-ink-muted mt-0.5 font-normal">{a.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary stat cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'On Track', value: totals.on_track, pct: pct(totals.on_track), color: '#166534', border: '#BBF7D0', Icon: TrendingUp },
                { label: 'Watch', value: totals.watch, pct: pct(totals.watch), color: '#92400E', border: '#FDE68A', Icon: Minus },
                { label: 'Off Track', value: totals.off_track, pct: pct(totals.off_track), color: '#991B1B', border: '#FECACA', Icon: Minus },
                { label: 'No Data', value: totals.no_data, pct: pct(totals.no_data), color: '#6B7280', border: '#E5E7EB', Icon: Minus },
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
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="table">Table</TabsTrigger>
              </TabsList>

              <TabsContent value="charts">
                {/* Stacked bar chart */}
                {!loading && chartData.length > 0 && (
                  <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl p-5 mb-6">
                    <h3 className="font-medium text-ink text-sm mb-4">Department KPI Status — {MONTHS[month - 1]} {year}</h3>
                    <ChartContainer config={chartConfig} className="h-[220px] w-full aspect-auto">
                      <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid horizontal={false} stroke="#F2F2F2" />
                        <XAxis type="number" tick={{ fontSize: 9, fill: '#AAAAAA' }} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#595959' }} tickLine={false} axisLine={false} width={80} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="onTrack" stackId="a" fill="var(--color-onTrack)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="watch" stackId="a" fill="var(--color-watch)" />
                        <Bar dataKey="offTrack" stackId="a" fill="var(--color-offTrack)" />
                        <Bar dataKey="noData" stackId="a" fill="var(--color-noData)" radius={[0, 2, 2, 0]} />
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
                                { v: dept.on_track, c: '#22C55E' },
                                { v: dept.watch, c: '#F59E0B' },
                                { v: dept.off_track, c: '#EF4444' },
                                { v: dept.no_data, c: '#D1D5DB' },
                              ].map((s, i) => s.v > 0 && (
                                <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ color: s.c, background: `${s.c}20` }}>
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
                <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden">
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
              </TabsContent>
            </Tabs>
          </div>
        </main>

        {rightPanelOpen && (
          <aside className="hidden lg:block w-[400px] shrink-0 overflow-y-auto">
            <AddOnsPanel />
          </aside>
        )}
      </div>
    </div>
  )
}
