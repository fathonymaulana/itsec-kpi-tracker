'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { useAuth, authHeaders } from '@/lib/auth'
import { MonthGrid } from '@/components/kpi/MonthGrid'
import { MONTHS, getDefaultMonth, getDefaultYear, getStatus, type KpiStatus } from '@/lib/status'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR]

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

const STATUS_COLORS = {
  on_track: '#22C55E',
  watch: '#F59E0B',
  off_track: '#EF4444',
  no_data: '#D1D5DB',
}

export default function BoardPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [month, setMonth] = useState(getDefaultMonth())
  const [year, setYear] = useState(getDefaultYear())
  const [summaries, setSummaries] = useState<DeptSummary[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [showAnomalies, setShowAnomalies] = useState(false)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role === 'dept_head') { router.push('/dept'); return }
  }, [user, router])

  const fetchData = useCallback(async () => {
    if (!user || !token) return
    setLoading(true)
    try {
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

  if (!user) return null

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
    'On Track': d.on_track,
    'Watch': d.watch,
    'Off Track': d.off_track,
    'No Data': d.no_data,
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
    <div className="min-h-screen flex flex-col bg-[#F4F4F4]">
      {/* Black/dark header for board */}
      <header className="bg-[#1A1A1A] px-6 md:px-8 py-4 flex items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-7 h-7 bg-[#CC1F1F] rounded-sm flex items-center justify-center">
            <span className="text-white font-semibold text-xs">IT</span>
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-none">ITSEC</div>
            <div className="text-white/40 text-[10px] font-normal">Executive Dashboard</div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[110px] h-7 text-xs bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-[80px] h-7 text-xs bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {user && (
          <div className="text-white/40 text-xs ml-2 hidden sm:block">{user.dept_name}</div>
        )}
      </header>

      <main className="flex-1 px-6 md:px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Anomaly alert */}
        {anomalies.length > 0 && (
          <button
            onClick={() => setShowAnomalies(s => !s)}
            className="w-full mb-6 flex items-center gap-3 bg-[#FFF8E6] border border-[#FDE68A] px-4 py-3 rounded-sm text-left hover:bg-[#FFF3CC] transition-colors"
          >
            <AlertTriangle size={15} className="text-[#B45309] shrink-0" />
            <span className="text-sm font-medium text-[#B45309] flex-1">
              {anomalies.length} unresolved anomaly{anomalies.length > 1 ? 'ies' : ''} across departments
            </span>
            {showAnomalies ? <ChevronUp size={14} className="text-[#B45309]" /> : <ChevronDown size={14} className="text-[#B45309]" />}
          </button>
        )}

        {showAnomalies && (
          <div className="mb-6 bg-white border border-[#EBEBEB] rounded-sm overflow-hidden">
            {anomalies.map((a, i) => (
              <div key={i} className={`px-4 py-3 flex items-start gap-3 ${i > 0 ? 'border-t border-[#F2F2F2]' : ''}`}>
                <AlertTriangle size={13} className="text-[#F59E0B] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-[#1A1A1A]">{a.department_name} — {a.kpi_name}</div>
                  <div className="text-xs text-[#808080] mt-0.5 font-normal">{a.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'On Track', value: totals.on_track, pct: pct(totals.on_track), color: '#166534', bg: '#DCFCE7', border: '#BBF7D0', Icon: TrendingUp },
            { label: 'Watch', value: totals.watch, pct: pct(totals.watch), color: '#92400E', bg: '#FEF9C3', border: '#FDE68A', Icon: Minus },
            { label: 'Off Track', value: totals.off_track, pct: pct(totals.off_track), color: '#991B1B', bg: '#FEE2E2', border: '#FECACA', Icon: TrendingDown },
            { label: 'No Data', value: totals.no_data, pct: pct(totals.no_data), color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', Icon: Minus },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-sm p-4 flex items-start gap-3" style={{ borderColor: s.border }}>
              <s.Icon size={16} style={{ color: s.color }} className="mt-0.5 shrink-0" />
              <div>
                <div className="text-2xl font-semibold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-[#808080] font-normal">{s.label}</div>
                <div className="text-[11px] mt-0.5 font-normal" style={{ color: s.color }}>{s.pct}%</div>
              </div>
            </div>
          ))}
        </div>

        {/* Stacked bar chart */}
        {!loading && chartData.length > 0 && (
          <div className="bg-white border border-[#EBEBEB] rounded-sm p-5 mb-6">
            <h3 className="font-medium text-[#1A1A1A] text-sm mb-4">Department KPI Status — {MONTHS[month - 1]} {year}</h3>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: '#AAAAAA' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#595959' }} tickLine={false} axisLine={false} width={80} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, border: '1px solid #EBEBEB', borderRadius: 2 }}
                    cursor={{ fill: '#F9F9F9' }}
                  />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="On Track" stackId="a" fill={STATUS_COLORS.on_track} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Watch" stackId="a" fill={STATUS_COLORS.watch} />
                  <Bar dataKey="Off Track" stackId="a" fill={STATUS_COLORS.off_track} />
                  <Bar dataKey="No Data" stackId="a" fill={STATUS_COLORS.no_data} radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Department accordion */}
        <div className="space-y-2">
          <h3 className="font-medium text-[#1A1A1A] text-sm mb-3">Department Breakdown</h3>
          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-white border border-[#EBEBEB] rounded-sm animate-pulse" />)}
            </div>
          ) : summaries.map(dept => {
            const expanded = expandedDepts.has(dept.dept_id)
            const onPct = dept.total > 0 ? Math.round(dept.on_track / dept.total * 100) : 0
            return (
              <div key={dept.dept_id} className="bg-white border border-[#EBEBEB] rounded-sm overflow-hidden">
                <button
                  onClick={() => toggleDept(dept.dept_id)}
                  className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-[#FAFAFA] transition-colors"
                >
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-[#1A1A1A]">{dept.department_name}</div>
                    <div className="text-xs text-[#AAAAAA] mt-0.5 font-normal">{dept.total} KPIs · {onPct}% on track</div>
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
                    {expanded ? <ChevronUp size={14} className="text-[#AAAAAA]" /> : <ChevronDown size={14} className="text-[#AAAAAA]" />}
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-[#F2F2F2] px-5 py-3">
                    <MonthGrid data={dept.month_statuses} compact />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
