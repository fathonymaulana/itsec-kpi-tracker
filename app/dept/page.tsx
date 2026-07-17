'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DisketteLinear as Save,
  PlainLinear as Send,
  DangerTriangleLinear as AlertTriangle,
  CheckCircleLinear as CheckCircle2,
  MagnifierLinear as Search,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { KpiCard } from '@/components/kpi/KpiCard'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { MONTHS, getDefaultMonth, getDefaultYear } from '@/lib/status'
import { Button } from '@/components/ui/button'
import { iconHoverClass } from '@/lib/utils'

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

export default function DeptPage() {
  const { user, token, ready } = useAuth()
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
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'dept_head') { router.push('/board'); return }
  }, [user, router, ready])

  const fetchKpis = useCallback(async () => {
    if (!user || !token) return
    setLoading(true)
    try {
      const r = await fetch(`/api/departments/${user.dept_id}/kpis`, { headers: authHeaders(token) })
      const data = await r.json()
      setKpis(data.kpis || [])
    } catch {
      toast.error('Couldn’t load your KPIs', { description: 'Please check your connection and try again.' })
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
      toast.error('Couldn’t load your saved data', { description: 'Please check your connection and try again.' })
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
            dept_id: user.dept_id ?? '',
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
        toast.warning(`Saved — but ${newAnomalies.length} ${newAnomalies.length > 1 ? 'entries look' : 'entry looks'} unusual`, {
          description: newAnomalies.map(a => a.description).join(' · '),
          duration: 8000,
        })
      } else {
        toast.success('Saved', { description: 'Your entries are stored as a draft — Submit Month when ready to send them for review.' })
      }
    } catch (err: unknown) {
      toast.error('Couldn’t save your entries', { description: err instanceof Error ? err.message : 'Please try again.' })
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
      toast.success(`${MONTHS[month - 1]} ${year} submitted`, { description: 'Your data is locked and ready for Corporate Planning’s review.' })
    } catch (err: unknown) {
      toast.error('Couldn’t submit this month', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const getKpiAnomalyCount = (kpiId: number) => anomalies.filter(a => a.kpi_id === kpiId).length

  const runSearch = () => setAppliedSearch(searchInput.trim())
  const visibleKpis = appliedSearch
    ? kpis.filter(k => k.name.toLowerCase().includes(appliedSearch.toLowerCase()))
    : kpis

  if (!ready || !user) return null

  return (
    <div className="h-screen flex flex-col bg-[#fafafa] overflow-hidden">
      <DeptTopNav />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: clock + date picker */}
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

        {/* Center: data entry */}
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-[#282828] tracking-[-0.6px]">Data Entry Section</h1>
                <p className="text-sm text-[#737373] mt-1 max-w-xl">
                  Enter this month&apos;s actuals for every KPI in {user.dept_name}. Save as you go, then Submit Month once everything looks right — submitted data locks and moves to Corporate Planning for review.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
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
              </div>
            </div>

            {/* Quick search — jumps to a matrix by name, doesn't hide the full entry form for anything else */}
            {kpis.length > 0 && (
              <div className="bg-white border border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl flex items-center gap-4 px-4 py-3.5 mb-6">
                <button onClick={() => router.push('/profile')} title="Profile" className="shrink-0">
                  <Avatar size="lg" className="size-10 ring-1 ring-[#e5e5e5]">
                    {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
                    <AvatarFallback className="text-xs">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </button>
                <div className="flex-1 min-w-0">
                  <input
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runSearch()}
                    placeholder="Search matrix name..."
                    className="w-full bg-[#f5f5f5] border border-[#e5e5e5] rounded-2xl px-4 py-2.5 text-base text-[#282828] placeholder:text-[#737373] focus:outline-none focus:border-[#CC1F1F]"
                  />
                </div>
                <button
                  onClick={runSearch}
                  className={`h-12 px-5 rounded-2xl bg-[#282828] hover:bg-[#171717] text-white text-sm font-medium flex items-center gap-2 shrink-0 transition-colors ${iconHoverClass}`}
                >
                  Start Search
                  <Search size={16} />
                </button>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-24 bg-white border border-[#e5e5e5] rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : kpis.length === 0 ? (
              <div className="text-center py-20 text-[#AAAAAA] text-sm">No KPIs configured for this department.</div>
            ) : (
              <div className="space-y-3 pb-28">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-medium text-[#282828] text-sm">{MONTHS[month - 1]} {year}</h2>
                  <span className="text-xs text-[#737373] font-normal">
                    {appliedSearch ? `${visibleKpis.length} of ${kpis.length} KPIs` : `${kpis.length} KPI${kpis.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                {visibleKpis.length === 0 ? (
                  <div className="text-center py-16 text-[#AAAAAA] text-sm">
                    No KPI matches &quot;{appliedSearch}&quot;.{' '}
                    <button onClick={() => { setSearchInput(''); setAppliedSearch('') }} className="text-[#CC1F1F] hover:underline">Clear search</button>
                  </div>
                ) : visibleKpis.map(kpi => (
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
          </div>

          {/* Sticky Save/Submit bar */}
          <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-gradient-to-t from-[#fafafa] via-[#fafafa] to-transparent flex justify-end gap-3">
            <Button
              variant="outline"
              className={`h-12 px-5 rounded-2xl gap-2 border-[#e5e5e5] bg-white ${iconHoverClass}`}
              onClick={handleSave}
              disabled={saving || submitted}
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              className={`h-12 px-5 rounded-2xl gap-2 bg-[#282828] hover:bg-[#171717] text-white ${iconHoverClass}`}
              onClick={handleSubmit}
              disabled={saving || submitted}
            >
              {submitted ? 'Submitted' : 'Submit Month'}
              <Send size={16} />
            </Button>
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
