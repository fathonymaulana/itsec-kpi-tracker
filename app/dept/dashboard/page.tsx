'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useAuth, authHeaders } from '@/lib/auth'
import { AppNav } from '@/components/layout/AppNav'
import { StatusBadge } from '@/components/kpi/StatusBadge'
import { MonthGrid } from '@/components/kpi/MonthGrid'
import { computeCalcValue } from '@/lib/calculations'
import { getStatus, MONTHS, type KpiStatus } from '@/lib/status'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR]

interface SubMetric {
  id: number; name: string; unit: string;
  is_calculated: number; formula_key: string | null; calc_input_positions: string | null
}
interface Kpi {
  id: number; name: string; target_text: string; numeric_target: number | null; direction: number
  sub_metrics: SubMetric[]
}

function computePrimaryValue(kpi: Kpi, valuesBySmId: Record<number, number>): number | null {
  const inputSMs = kpi.sub_metrics.filter(sm => !sm.is_calculated)
  const calcSMs = kpi.sub_metrics.filter(sm => sm.is_calculated)
  if (calcSMs.length > 0) {
    const sm = calcSMs[0]
    if (!sm.formula_key) return null
    const positions: number[] = sm.calc_input_positions
      ? sm.calc_input_positions.split(',').map(p => parseInt(p.trim()) - 1)
      : inputSMs.map((_, i) => i)
    const inputs = positions.map(pos => {
      const inputSm = inputSMs[pos]
      if (!inputSm) return null
      const v = valuesBySmId[inputSm.id]
      return v === undefined ? null : v
    })
    return computeCalcValue(sm.formula_key, inputs)
  }
  const first = inputSMs[0]
  if (!first) return null
  const v = valuesBySmId[first.id]
  return v === undefined ? null : v
}

export default function DeptDashboard() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [year, setYear] = useState(CURRENT_YEAR)
  const [allActuals, setAllActuals] = useState<Record<number, Record<number, number>>>({}) // month → {smId → value}
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role !== 'dept_head') { router.push('/board'); return }
  }, [user, router])

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
    const v = computePrimaryValue(kpi, vals)
    return getStatus(v, kpi.numeric_target, kpi.direction)
  })
  const onTrack = statuses.filter(s => s === 'on_track').length
  const watch = statuses.filter(s => s === 'watch').length
  const offTrack = statuses.filter(s => s === 'off_track').length
  const noData = statuses.filter(s => s === 'no_data').length

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F4F4]">
      <AppNav
        title={user.dept_name}
        subtitle="Dashboard"
        actions={
          <button
            onClick={() => router.push('/dept')}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs px-2.5 py-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Data Entry</span>
          </button>
        }
      />

      <div className="bg-white border-b border-[#EBEBEB] px-6 md:px-8 py-3 flex items-center gap-3">
        <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-[90px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {YEARS.map(y => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <span className="text-xs text-[#AAAAAA]">{kpis.length} KPIs</span>
      </div>

      <main className="flex-1 px-6 md:px-8 py-6 max-w-6xl mx-auto w-full">
        {/* Stat summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'On Track', value: onTrack, color: '#166534', bg: '#DCFCE7', border: '#BBF7D0' },
            { label: 'Watch', value: watch, color: '#92400E', bg: '#FEF9C3', border: '#FDE68A' },
            { label: 'Off Track', value: offTrack, color: '#991B1B', bg: '#FEE2E2', border: '#FECACA' },
            { label: 'No Data', value: noData, color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
          ].map(s => (
            <div key={s.label} className="bg-white border rounded-sm p-4" style={{ borderColor: s.border }}>
              <div className="text-2xl font-semibold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-[#808080] mt-1 font-normal">{s.label}</div>
            </div>
          ))}
        </div>

        {/* KPI cards with charts */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-white border border-[#EBEBEB] rounded-sm animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {kpis.map(kpi => {
              const monthStatuses: Partial<Record<number, KpiStatus>> = {}
              const chartData = MONTHS.map((label, mi) => {
                const m = mi + 1
                const vals = allActuals[m] || {}
                const v = computePrimaryValue(kpi, vals)
                const status = getStatus(v, kpi.numeric_target, kpi.direction)
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
              const currentV = computePrimaryValue(kpi, currentVals)
              const currentStatus = getStatus(currentV, kpi.numeric_target, kpi.direction)

              return (
                <div key={kpi.id} className="bg-white border border-[#EBEBEB] rounded-sm overflow-hidden">
                  <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#1A1A1A] text-sm">{kpi.name}</span>
                        <StatusBadge status={currentStatus} />
                      </div>
                      <div className="text-[#808080] text-xs mt-0.5 font-normal">Target: {kpi.target_text}</div>
                    </div>
                    {currentV !== null && (
                      <div className="text-right shrink-0">
                        <div className="text-lg font-medium text-[#1A1A1A]">
                          {unit === '%' ? `${(currentV * 100).toFixed(1)}%`
                            : unit === 'x' ? `${currentV.toFixed(2)}×`
                            : currentV.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </div>
                        <div className="text-[10px] text-[#AAAAAA]">{MONTHS[currentMonth - 1]}</div>
                      </div>
                    )}
                  </div>

                  {hasData && (
                    <div className="px-2 pb-1" style={{ height: 100 }}>
                      <ResponsiveContainer width="100%" height="100%">
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
                          <Tooltip
                            contentStyle={{ fontSize: 11, border: '1px solid #EBEBEB', borderRadius: 2, padding: '4px 8px' }}
                            formatter={(v: number) => [unit === '%' ? `${v}%` : v, kpi.name]}
                            labelStyle={{ color: '#808080' }}
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
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="px-5 py-3 border-t border-[#F2F2F2]">
                    <MonthGrid data={monthStatuses} compact />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
