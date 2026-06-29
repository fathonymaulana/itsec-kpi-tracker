'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Save, Send, AlertTriangle, CheckCircle2, LayoutDashboard } from 'lucide-react'
import { useAuth, authHeaders } from '@/lib/auth'
import { AppNav } from '@/components/layout/AppNav'
import { KpiCard } from '@/components/kpi/KpiCard'
import { MONTHS, getDefaultMonth, getDefaultYear } from '@/lib/status'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SubMetric {
  id: number
  name: string
  unit: string
  is_calculated: number
  formula_key: string | null
  calc_input_positions: string | null
}

interface Kpi {
  id: number
  name: string
  target_text: string
  numeric_target: number | null
  direction: number
  sub_metrics: SubMetric[]
}

interface Actual {
  id: number
  sub_metric_id: number
  value: number
  data_source_url?: string
  data_source_note?: string
}

interface Anomaly {
  id: number
  kpi_id: number
  sub_metric_id: number
  type: string
  description: string
  dismissed: number
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function DeptPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [month, setMonth] = useState(getDefaultMonth())
  const [year, setYear] = useState(getDefaultYear())
  const [values, setValues] = useState<Record<number, string>>({})
  const [savedActuals, setSavedActuals] = useState<Record<number, Actual>>({}) // sub_metric_id → actual
  const [dataSources, setDataSources] = useState<Record<number, { url: string; note: string }>>({}) // kpi_id → ds
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (!user) { router.push('/login'); return }
    if (user.role !== 'dept_head') { router.push('/board'); return }
  }, [user, router])

  const fetchKpis = useCallback(async () => {
    if (!user || !token) return
    setLoading(true)
    try {
      const r = await fetch(`/api/departments/${user.dept_id}/kpis`, { headers: authHeaders(token) })
      const data = await r.json()
      setKpis(data.kpis || [])
    } catch {
      toast.error('Failed to load KPIs')
    } finally {
      setLoading(false)
    }
  }, [user, token])

  const fetchActuals = useCallback(async () => {
    if (!user || !token) return
    try {
      const r = await fetch(`/api/actuals?dept_id=${user.dept_id}&year=${year}&month=${month}`, { headers: authHeaders(token) })
      const data = await r.json()
      const vals: Record<number, string> = {}
      const actMap: Record<number, Actual> = {}
      const ds: Record<number, { url: string; note: string }> = {}
      for (const a of (data.actuals || [])) {
        vals[a.sub_metric_id] = String(a.value)
        actMap[a.sub_metric_id] = a
        if (a.kpi_id && a.data_source_url) {
          ds[a.kpi_id] = { url: a.data_source_url, note: a.data_source_note || '' }
        }
      }
      setValues(vals)
      setSavedActuals(actMap)
      setDataSources(ds)
    } catch {
      toast.error('Failed to load actuals')
    }
  }, [user, token, year, month])

  const fetchAnomalies = useCallback(async () => {
    if (!user || !token) return
    try {
      const r = await fetch(`/api/anomalies?dept_id=${user.dept_id}&year=${year}&month=${month}`, { headers: authHeaders(token) })
      const data = await r.json()
      setAnomalies((data.anomalies || []).filter((a: Anomaly) => !a.dismissed))
    } catch { /* non-fatal */ }
  }, [user, token, year, month])

  const checkSubmission = useCallback(async () => {
    if (!user || !token) return
    try {
      const r = await fetch(`/api/submissions?dept_id=${user.dept_id}&year=${year}&month=${month}`, { headers: authHeaders(token) })
      const data = await r.json()
      setSubmitted((data.submissions || []).length > 0)
    } catch { /* non-fatal */ }
  }, [user, token, year, month])

  useEffect(() => {
    if (!hasFetchedRef.current && user) { fetchKpis(); hasFetchedRef.current = true }
  }, [user, fetchKpis])

  useEffect(() => {
    if (user) { fetchActuals(); fetchAnomalies(); checkSubmission() }
  }, [user, fetchActuals, fetchAnomalies, checkSubmission])

  const handleValueChange = (subMetricId: number, val: string) => {
    setValues(prev => ({ ...prev, [subMetricId]: val }))
  }

  const handleDataSourceSave = async (kpiId: number, url: string, note: string) => {
    if (!token) return
    setDataSources(prev => ({ ...prev, [kpiId]: { url, note } }))
    // Find the first actual for this KPI and patch its datasource
    const kpi = kpis.find(k => k.id === kpiId)
    if (!kpi) return
    const firstInputSm = kpi.sub_metrics.find(sm => !sm.is_calculated)
    if (!firstInputSm) return
    const act = savedActuals[firstInputSm.id]
    if (act) {
      await fetch(`/api/actuals/${act.id}/datasource`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_source_url: url, data_source_note: note }),
      })
    }
  }

  const handleSave = async () => {
    if (!user || !token) return
    setSaving(true)
    try {
      const payload: { sub_metric_id: number; kpi_id: number; dept_id: string; year: number; month: number; value: number; data_source_url?: string; data_source_note?: string }[] = []
      for (const kpi of kpis) {
        const ds = dataSources[kpi.id]
        for (const sm of kpi.sub_metrics.filter(s => !s.is_calculated)) {
          const raw = values[sm.id]
          if (raw === undefined || raw === '') continue
          const value = parseFloat(raw)
          if (isNaN(value)) continue
          payload.push({
            sub_metric_id: sm.id,
            kpi_id: kpi.id,
            dept_id: user.dept_id,
            year,
            month,
            value,
            ...(ds ? { data_source_url: ds.url, data_source_note: ds.note } : {}),
          })
        }
      }
      const r = await fetch('/api/actuals', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ actuals: payload }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Save failed')

      // Refresh actuals and anomalies
      await fetchActuals()
      await fetchAnomalies()

      const newAnomalies = (data.anomalies || []) as Anomaly[]
      if (newAnomalies.length > 0) {
        toast.warning(`${newAnomalies.length} anomaly${newAnomalies.length > 1 ? 'ies' : ''} detected — please review`, {
          description: newAnomalies.map(a => a.description).join('; '),
          duration: 8000,
        })
      } else {
        toast.success('Data saved successfully')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!user || !token) return
    setSaving(true)
    try {
      const r = await fetch('/api/submissions', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ dept_id: user.dept_id, year, month }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Submit failed')
      setSubmitted(true)
      toast.success(`${MONTHS[month - 1]} ${year} submitted for review`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  const getKpiAnomalyCount = (kpiId: number) => anomalies.filter(a => a.kpi_id === kpiId).length

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F4F4]">
      <AppNav
        title={user.dept_name}
        subtitle="Data Entry"
        actions={
          <button
            onClick={() => router.push('/dept/dashboard')}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs px-2.5 py-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <LayoutDashboard size={13} />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
        }
      />

      {/* Controls bar */}
      <div className="bg-white border-b border-[#EBEBEB] px-6 md:px-8 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
            <SelectTrigger className="w-[90px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map(y => (
                <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1" />

        {submitted && (
          <div className="flex items-center gap-1.5 text-xs text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0] px-3 py-1 rounded-full">
            <CheckCircle2 size={12} />
            Submitted
          </div>
        )}

        {anomalies.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[#B45309] bg-[#FFF8E6] border border-[#FDE68A] px-3 py-1 rounded-full">
            <AlertTriangle size={12} />
            {anomalies.length} anomaly{anomalies.length > 1 ? 'ies' : ''} flagged
          </div>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={handleSave}
          disabled={saving || submitted}
        >
          <Save size={13} />
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs gap-1.5 bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white"
          onClick={handleSubmit}
          disabled={saving || submitted}
        >
          <Send size={13} />
          {submitted ? 'Submitted' : 'Submit Month'}
        </Button>
      </div>

      {/* Main content */}
      <main className="flex-1 px-6 md:px-8 py-6 max-w-5xl mx-auto w-full">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-white border border-[#EBEBEB] rounded-sm animate-pulse" />
            ))}
          </div>
        ) : kpis.length === 0 ? (
          <div className="text-center py-20 text-[#AAAAAA] text-sm">No KPIs configured for this department.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-medium text-[#1A1A1A] text-sm">{MONTHS[month - 1]} {year}</h2>
              <span className="text-xs text-[#AAAAAA] font-normal">{kpis.length} KPI{kpis.length > 1 ? 's' : ''}</span>
            </div>
            {kpis.map(kpi => (
              <KpiCard
                key={kpi.id}
                kpi={kpi}
                values={values}
                dataSource={dataSources[kpi.id]}
                anomalyCount={getKpiAnomalyCount(kpi.id)}
                onValueChange={handleValueChange}
                onDataSourceSave={handleDataSourceSave}
                readOnly={submitted}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
