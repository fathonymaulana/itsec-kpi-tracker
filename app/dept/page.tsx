'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DisketteLineDuotone as Save,
  PlainLineDuotone as Send,
  CheckCircleLineDuotone as CheckCircle2,
  MagnifierLineDuotone as Search,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { AnimatedAside } from '@/components/layout/AnimatedAside'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
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
  frequency?: string | null
  sub_metrics: SubMetric[]
}

interface Actual {
  id: number
  sub_metric_id: number
  value: number
  data_source_url?: string
  data_source_note?: string
  last_updated_at?: string
}

interface ModifyRequest {
  id: number
  kpi_id: number
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  review_note: string | null
}

const CURRENT_YEAR = new Date().getFullYear()

export default function DeptPage() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [month, setMonth] = useState(getDefaultMonth())
  const [year, setYear] = useState(getDefaultYear())
  const [values, setValues] = useState<Record<number, string>>({})
  const [yearActuals, setYearActuals] = useState<Record<number, Record<number, number>>>({}) // month → smId → value
  const [savedActuals, setSavedActuals] = useState<Record<number, Actual>>({}) // sub_metric_id → actual
  const [dataSources, setDataSources] = useState<Record<number, { url: string; note: string }>>({}) // kpi_id → ds
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [modifyRequests, setModifyRequests] = useState<ModifyRequest[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
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
      let latestSavedAt: Date | null = null
      for (const a of (data.actuals || [])) {
        vals[a.sub_metric_id] = String(a.value)
        actMap[a.sub_metric_id] = a
        if (a.kpi_id && a.data_source_url) {
          ds[a.kpi_id] = { url: a.data_source_url, note: a.data_source_note || '' }
        }
        if (a.last_updated_at) {
          const t = new Date(a.last_updated_at)
          if (!latestSavedAt || t > latestSavedAt) latestSavedAt = t
        }
      }
      setValues(vals)
      setSavedActuals(actMap)
      setDataSources(ds)
      setLastSavedAt(latestSavedAt)
      setIsDirty(false)
    } catch {
      toast.error('Couldn’t load your saved data', { description: 'Please check your connection and try again.' })
    }
  }, [user, token, year, month])

  // Whole year's actuals, independent of the single month being edited above — needed so KpiCard can
  // sum a quarter/year's entries for KPIs whose target isn't monthly (see lib/frequency.ts).
  const fetchYearActuals = useCallback(async () => {
    if (!user || !token) return
    try {
      const r = await fetch(`/api/actuals?dept_id=${user.dept_id}&year=${year}`, { headers: authHeaders(token) })
      const data = await r.json()
      const byMonth: Record<number, Record<number, number>> = {}
      for (const a of (data.actuals || [])) {
        if (!byMonth[a.month]) byMonth[a.month] = {}
        byMonth[a.month][a.sub_metric_id] = a.value
      }
      setYearActuals(byMonth)
    } catch { /* non-fatal */ }
  }, [user, token, year])

  const checkSubmission = useCallback(async () => {
    if (!user || !token) return
    try {
      const r = await fetch(`/api/submissions?dept_id=${user.dept_id}&year=${year}&month=${month}`, { headers: authHeaders(token) })
      const data = await r.json()
      setSubmitted((data.submissions || []).length > 0)
    } catch { /* non-fatal */ }
  }, [user, token, year, month])

  const fetchModifyRequests = useCallback(async () => {
    if (!user || !token) return
    try {
      const r = await fetch(`/api/modify-requests?year=${year}&month=${month}`, { headers: authHeaders(token) })
      const data = await r.json()
      setModifyRequests(data.requests || [])
    } catch { /* non-fatal */ }
  }, [user, token, year, month])

  useEffect(() => {
    if (!hasFetchedRef.current && user) { fetchKpis(); hasFetchedRef.current = true }
  }, [user, fetchKpis])

  useEffect(() => {
    if (user) { fetchActuals(); fetchYearActuals(); checkSubmission(); fetchModifyRequests() }
  }, [user, fetchActuals, fetchYearActuals, checkSubmission, fetchModifyRequests])

  const handleValueChange = (subMetricId: number, val: string) => {
    setValues(prev => ({ ...prev, [subMetricId]: val }))
    setIsDirty(true)
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

  // Shared by the Save button and by Submit (which always saves first, in case the dept_head
  // typed values and hit Submit without ever clicking Save) — one payload builder, one POST.
  const saveActuals = async (): Promise<void> => {
    if (!user || !token) return
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

    await fetchActuals()
    await fetchYearActuals()
    setLastSavedAt(new Date())
    setIsDirty(false)
  }

  const handleSave = async () => {
    if (!user || !token) return
    setSaving(true)
    try {
      await saveActuals()
      toast.success('Saved', { description: 'Your entries are stored as a draft — Submit Month when ready to send them for review.' })
    } catch (err: unknown) {
      toast.error('Couldn’t save your entries', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!user || !token) return
    setSubmitting(true)
    try {
      // Always save first — covers the dept_head who typed values and went straight to Submit
      // without clicking Save, so nothing typed is lost when the month locks.
      await saveActuals()

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
      setSubmitting(false)
    }
  }

  // Most recent request per KPI — a fresh pending one always wins; an older rejected one only shows
  // if there's nothing more recent, so a re-request cleanly replaces the "Request Again" state.
  const getModifyStatus = (kpiId: number): 'pending' | 'rejected' | null => {
    const forKpi = modifyRequests.filter(r => r.kpi_id === kpiId)
    if (forKpi.some(r => r.status === 'pending')) return 'pending'
    if (forKpi.some(r => r.status === 'rejected')) return 'rejected'
    return null
  }

  const handleRequestModify = async (kpiId: number, reason: string) => {
    if (!token) return
    try {
      const r = await fetch('/api/modify-requests', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpi_id: kpiId, year, month, reason }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Request failed')
      await fetchModifyRequests()
      toast.success('Request sent to Corporate Planning', { description: 'You’ll be able to edit this matrix again once it’s approved.' })
    } catch (err) {
      toast.error('Couldn’t send that request', { description: err instanceof Error ? err.message : 'Please try again.' })
    }
  }

  const runSearch = () => setAppliedSearch(searchInput.trim())
  const visibleKpis = appliedSearch
    ? kpis.filter(k => k.name.toLowerCase().includes(appliedSearch.toLowerCase()))
    : kpis

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
        {/* Left: clock + date picker */}
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

        {/* Center: data entry */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Data Entry Section</h1>
                <p className="text-sm text-ink-muted mt-1 max-w-xl">
                  Enter this month&apos;s actuals for every KPI in {user.dept_name}. Save as you go, then Submit Month once everything looks right — submitted data locks and moves to Corporate Planning for review.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {submitted && (
                  <div className="flex items-center gap-1.5 text-xs text-success bg-success-soft border border-success-soft-border px-3 py-1 rounded-full">
                    <CheckCircle2 size={12} />
                    Submitted
                  </div>
                )}
              </div>
            </div>

            {/* Quick search — jumps to a matrix by name, doesn't hide the full entry form for anything else */}
            {kpis.length > 0 && (
              <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-3xl flex items-center gap-4 px-4 py-3.5 mb-6">
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
                    className="w-full bg-panel-soft border border-divider rounded-2xl px-4 py-2.5 text-base text-ink placeholder:text-ink-muted focus:outline-none focus:border-[#CC1F1F]"
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
                  <div key={i} className="h-24 bg-panel border border-divider rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : kpis.length === 0 ? (
              <div className="text-center py-20 text-ink-faint text-sm">No KPIs configured for this department.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-medium text-ink text-sm">{MONTHS[month - 1]} {year}</h2>
                  <span className="text-xs text-ink-muted font-normal">
                    {appliedSearch ? `${visibleKpis.length} of ${kpis.length} KPIs` : `${kpis.length} KPI${kpis.length > 1 ? 's' : ''}`}
                  </span>
                </div>
                {visibleKpis.length === 0 ? (
                  <div className="text-center py-16 text-ink-faint text-sm">
                    No KPI matches &quot;{appliedSearch}&quot;.{' '}
                    <button onClick={() => { setSearchInput(''); setAppliedSearch('') }} className="text-[#CC1F1F] hover:underline">Clear search</button>
                  </div>
                ) : visibleKpis.map(kpi => (
                  <KpiCard
                    key={kpi.id}
                    kpi={kpi}
                    values={values}
                    yearActuals={yearActuals}
                    month={month}
                    dataSource={dataSources[kpi.id]}
                    onValueChange={handleValueChange}
                    onDataSourceSave={handleDataSourceSave}
                    readOnly={submitted}
                    modifyRequestStatus={submitted ? getModifyStatus(kpi.id) : undefined}
                    onRequestModify={submitted ? handleRequestModify : undefined}
                  />
                ))}
              </div>
            )}
          </div>
          </div>

          {/* Save/Submit action bar — pinned flush to the bottom of the screen, not floating over content */}
          <div className="shrink-0 border-t border-divider bg-app px-6 py-4 flex justify-end gap-3">
            <Button
              variant="outline"
              className={`h-12 px-5 rounded-2xl gap-2 border-divider bg-panel text-ink ${iconHoverClass}`}
              onClick={handleSave}
              disabled={saving || submitting || submitted}
            >
              {!saving && !isDirty && lastSavedAt ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {saving
                ? 'Saving…'
                : !isDirty && lastSavedAt
                  ? `Saved · ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Save'}
            </Button>
            <Button
              className={`h-12 px-5 rounded-2xl gap-2 bg-[#282828] hover:bg-[#171717] text-white ${iconHoverClass}`}
              onClick={handleSubmit}
              disabled={saving || submitting || submitted}
            >
              {submitted ? 'Submitted' : submitting ? 'Submitting…' : 'Submit Month'}
              <Send size={16} />
            </Button>
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
