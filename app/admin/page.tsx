'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircleLineDuotone as CheckCircle2,
  DangerTriangleLineDuotone as AlertTriangle,
  SquareArrowRightUpLineDuotone as ExternalLink,
  AltArrowRightLineDuotone as ChevronRight,
  BuildingsLineDuotone as Building2,
  ShieldLineDuotone as Shield,
  ClockCircleLineDuotone as Clock,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { KpiCard } from '@/components/kpi/KpiCard'
import { getDefaultMonth, getDefaultYear } from '@/lib/status'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CURRENT_YEAR = new Date().getFullYear()

interface Dept { id: string; name: string; submitted: boolean }
interface SubMetric { id: number; name: string; unit: string; is_calculated: number; formula_key: string | null; calc_input_positions: string | null }
interface Kpi { id: number; name: string; target_text: string; numeric_target: number | null; direction: number; sub_metrics: SubMetric[] }
interface Actual { id: number; sub_metric_id: number; kpi_id: number; value: number; data_source_url?: string; data_source_note?: string }
interface Anomaly { id: number; kpi_id: number; sub_metric_id: number; type: string; description: string; dismissed: number; created_at: string }
interface Verification { id: number; kpi_id: number; status: 'pending' | 'verified' | 'flagged'; note: string; verified_at: string }

type TabKey = 'data' | 'anomalies' | 'verifications'

export default function AdminPage() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [depts, setDepts] = useState<Dept[]>([])
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [month, setMonth] = useState(getDefaultMonth())
  const [year, setYear] = useState(getDefaultYear())
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [actuals, setActuals] = useState<Record<number, Actual>>({}) // smId → actual
  const [dataSources, setDataSources] = useState<Record<number, { url: string; note: string }>>({}) // kpi_id → ds
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [tab, setTab] = useState<TabKey>('data')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  const canVerify = user?.role === 'corp_planning'

  // Deep-link from the board's "View KPI details" links: /admin?dept=CorCom
  useEffect(() => {
    const deptFromUrl = new URLSearchParams(window.location.search).get('dept')
    if (deptFromUrl) setSelectedDept(deptFromUrl)
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (user.role === 'dept_head') { router.push('/dept'); return }
  }, [user, router, ready])

  // Fetch departments
  const fetchDepts = useCallback(async () => {
    if (!token) return
    try {
      const r = await fetch('/api/departments', { headers: authHeaders(token) })
      const data = await r.json()
      const deptsRaw = data.departments || []
      // Check submissions
      const withSubs = await Promise.all(deptsRaw.map(async (d: { id: string; name: string }) => {
        const sr = await fetch(`/api/submissions?dept_id=${d.id}&year=${year}&month=${month}`, { headers: authHeaders(token) })
        const sd = await sr.json()
        return { id: d.id, name: d.name, submitted: (sd.submissions || []).length > 0 }
      }))
      setDepts(withSubs)
    } catch { /* non-fatal */ }
  }, [token, year, month])

  useEffect(() => { if (user) fetchDepts() }, [user, fetchDepts])

  // Fetch selected dept data — every request below is scoped by selectedDept's dept_id, so switching
  // the picker is the only way to see another department's data; nothing here ever mixes departments.
  const fetchDeptData = useCallback(async () => {
    if (!token || !selectedDept) return
    setLoading(true)
    try {
      const [kpiRes, actRes, anoRes, verRes] = await Promise.all([
        fetch(`/api/departments/${selectedDept}/kpis`, { headers: authHeaders(token) }),
        fetch(`/api/actuals?dept_id=${selectedDept}&year=${year}&month=${month}`, { headers: authHeaders(token) }),
        fetch(`/api/anomalies?dept_id=${selectedDept}&year=${year}&month=${month}`, { headers: authHeaders(token) }),
        fetch(`/api/verifications?dept_id=${selectedDept}&year=${year}&month=${month}`, { headers: authHeaders(token) }),
      ])
      const kpiData = await kpiRes.json()
      const actData = await actRes.json()
      const anoData = await anoRes.json()
      const verData = await verRes.json()

      setKpis(kpiData.kpis || [])

      const actMap: Record<number, Actual> = {}
      const vals: Record<number, string> = {}
      const ds: Record<number, { url: string; note: string }> = {}
      for (const a of (actData.actuals || [])) {
        actMap[a.sub_metric_id] = a
        vals[a.sub_metric_id] = String(a.value)
        if (a.kpi_id && a.data_source_url) {
          ds[a.kpi_id] = { url: a.data_source_url, note: a.data_source_note || '' }
        }
      }
      setActuals(actMap)
      setDataSources(ds)
      setAnomalies(anoData.anomalies || [])
      setVerifications(verData.verifications || [])
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [token, selectedDept, year, month])

  useEffect(() => { if (selectedDept) fetchDeptData() }, [selectedDept, fetchDeptData])

  const handleVerify = async (kpiId: number, status: 'verified' | 'flagged', note = '') => {
    if (!token || !selectedDept) return
    setActionLoading(kpiId)
    try {
      const r = await fetch('/api/verifications', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpi_id: kpiId, dept_id: selectedDept, year, month, status, note }),
      })
      if (!r.ok) throw new Error('Failed')
      await fetchDeptData()
      toast.success(
        status === 'verified' ? 'Marked as verified' : 'Flagged for correction',
        { description: status === 'verified' ? 'This KPI is confirmed accurate for the period.' : 'The department will see this flag on their entry.' }
      )
    } catch {
      toast.error('That action didn’t go through', { description: 'Please try again.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDismissAnomaly = async (anomalyId: number) => {
    if (!token) return
    setActionLoading(anomalyId)
    try {
      const r = await fetch(`/api/anomalies/${anomalyId}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: 1 }),
      })
      if (!r.ok) throw new Error('Failed')
      await fetchDeptData()
      toast.success('Anomaly dismissed')
    } catch {
      toast.error('Couldn’t dismiss that anomaly', { description: 'Please try again.' })
    } finally {
      setActionLoading(null)
    }
  }

  const valuesAsStrings: Record<number, string> = Object.fromEntries(
    Object.entries(actuals).map(([smId, a]) => [smId, String(a.value)])
  )

  const getKpiVerification = (kpiId: number) => verifications.find(v => v.kpi_id === kpiId)
  const getKpiAnomalies = (kpiId: number) => anomalies.filter(a => a.kpi_id === kpiId && !a.dismissed)

  const selectedDeptObj = depts.find(d => d.id === selectedDept)
  const pendingVerifications = kpis.filter(k => !getKpiVerification(k.id)).length
  const activeAnomalies = anomalies.filter(a => !a.dismissed).length

  if (!ready || !user) return null

  return (
    <div className="h-screen flex flex-col bg-[#fafafa] overflow-hidden">
      <DeptTopNav
        onToggleLeftPanel={() => setLeftPanelOpen(v => !v)}
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
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-[#282828] tracking-[-0.6px]">
                {canVerify ? 'Data Verification' : 'Data Review'}
              </h1>
              <p className="text-sm text-[#737373] mt-1">
                Pick a department to review its submitted KPIs, flag anomalies, and verify entries for the period.
              </p>
            </div>

            <div className="bg-white border border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap">
              <Select value={selectedDept || ''} onValueChange={v => { if (v) { setSelectedDept(v); setTab('data') } }}>
                <SelectTrigger className="w-full sm:w-[240px] !h-9 rounded-lg border-[#e5e5e5]">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {depts.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      <Building2 size={13} className="mr-1 inline" /> {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDeptObj?.submitted && (
                <span className="flex items-center gap-1 text-xs text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0] px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={11} /> Submitted
                </span>
              )}
            </div>

            {!selectedDept ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Building2 size={32} className="text-[#DDDDDD] mb-4" />
                <div className="text-[#AAAAAA] text-sm">Select a department to review</div>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="bg-white border border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl px-2 flex gap-1 mb-4">
                  {([
                    { key: 'data', label: 'Data Review', icon: ChevronRight },
                    { key: 'anomalies', label: `Anomalies${activeAnomalies > 0 ? ` (${activeAnomalies})` : ''}`, icon: AlertTriangle },
                    { key: 'verifications', label: `Verifications${pendingVerifications > 0 ? ` (${pendingVerifications})` : ''}`, icon: Shield },
                  ] as { key: TabKey; label: string; icon: React.ElementType }[]).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 transition-colors ${
                        tab === t.key
                          ? 'border-[#CC1F1F] text-[#CC1F1F] font-medium'
                          : 'border-transparent text-[#737373] hover:text-[#595959]'
                      }`}
                    >
                      <t.icon size={12} />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* DATA TAB */}
                {tab === 'data' && (
                  <div className="space-y-3">
                    {loading ? (
                      [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white border border-[#e5e5e5] rounded-3xl animate-pulse" />)
                    ) : kpis.length === 0 ? (
                      <div className="text-center py-16 text-[#AAAAAA] text-sm">No data for this period.</div>
                    ) : kpis.map(kpi => {
                      const verification = getKpiVerification(kpi.id)
                      const kpiAnomalies = getKpiAnomalies(kpi.id)
                      return (
                        <div key={kpi.id} className="space-y-1">
                          <KpiCard
                            kpi={kpi}
                            values={valuesAsStrings}
                            dataSource={dataSources[kpi.id]}
                            anomalyCount={kpiAnomalies.length}
                            readOnly
                          />
                          {/* Verification status / action row */}
                          <div className="flex items-center gap-2 px-1">
                            {verification ? (
                              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                                verification.status === 'verified'
                                  ? 'text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0]'
                                  : 'text-[#991B1B] bg-[#FEE2E2] border border-[#FECACA]'
                              }`}>
                                {verification.status === 'verified'
                                  ? <><CheckCircle2 size={10} /> Verified</>
                                  : <><AlertTriangle size={10} /> Flagged</>}
                                {verification.note && <span className="ml-1 text-[10px]">— {verification.note}</span>}
                              </div>
                            ) : canVerify ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] gap-1 text-[#166534] border-[#BBF7D0] hover:bg-[#DCFCE7]"
                                  disabled={actionLoading === kpi.id}
                                  onClick={() => handleVerify(kpi.id, 'verified')}
                                >
                                  <CheckCircle2 size={10} />
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] gap-1 text-[#991B1B] border-[#FECACA] hover:bg-[#FEE2E2]"
                                  disabled={actionLoading === kpi.id}
                                  onClick={() => handleVerify(kpi.id, 'flagged', 'Needs correction')}
                                >
                                  <AlertTriangle size={10} />
                                  Flag
                                </Button>
                              </>
                            ) : (
                              <span className="text-[11px] text-[#AAAAAA]">Pending verification</span>
                            )}
                            {dataSources[kpi.id]?.url && (
                              <a
                                href={dataSources[kpi.id].url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[11px] text-[#737373] hover:text-[#CC1F1F] ml-auto"
                              >
                                <ExternalLink size={10} />
                                Source
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* ANOMALIES TAB */}
                {tab === 'anomalies' && (
                  <div>
                    {anomalies.length === 0 ? (
                      <div className="text-center py-16 text-[#AAAAAA] text-sm">No anomalies for this period.</div>
                    ) : (
                      <div className="space-y-2">
                        {anomalies.map(a => (
                          <div
                            key={a.id}
                            className={`bg-white border border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-4 flex items-start gap-3 ${a.dismissed ? 'opacity-50' : ''}`}
                          >
                            <AlertTriangle size={14} className={a.dismissed ? 'text-[#DDDDDD]' : 'text-[#F59E0B]'} />
                            <div className="flex-1">
                              <div className="text-xs font-medium text-[#282828]">{kpis.find(k => k.id === a.kpi_id)?.name || 'Unknown KPI'}</div>
                              <div className="text-xs text-[#737373] mt-0.5 font-normal">{a.description}</div>
                              <div className="text-[10px] text-[#AAAAAA] mt-1 flex items-center gap-1">
                                <Clock size={9} />
                                {new Date(a.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            {!a.dismissed && canVerify && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[11px] shrink-0"
                                disabled={actionLoading === a.id}
                                onClick={() => handleDismissAnomaly(a.id)}
                              >
                                Dismiss
                              </Button>
                            )}
                            {a.dismissed && (
                              <span className="text-[10px] text-[#AAAAAA] shrink-0">Dismissed</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* VERIFICATIONS TAB */}
                {tab === 'verifications' && (
                  <div>
                    {kpis.length === 0 ? (
                      <div className="text-center py-16 text-[#AAAAAA] text-sm">No KPIs loaded.</div>
                    ) : (
                      <div className="space-y-2">
                        {kpis.map(kpi => {
                          const v = getKpiVerification(kpi.id)
                          return (
                            <div key={kpi.id} className="bg-white border border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl px-4 py-3 flex items-center gap-3">
                              <div className="flex-1">
                                <div className="text-xs font-medium text-[#282828]">{kpi.name}</div>
                                <div className="text-[11px] text-[#AAAAAA] mt-0.5 font-normal">{kpi.target_text}</div>
                              </div>
                              {v ? (
                                <div className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ${
                                  v.status === 'verified'
                                    ? 'text-[#166534] bg-[#DCFCE7]'
                                    : 'text-[#991B1B] bg-[#FEE2E2]'
                                }`}>
                                  {v.status === 'verified' ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                                  <span className="capitalize">{v.status}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#AAAAAA]">Pending</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
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
