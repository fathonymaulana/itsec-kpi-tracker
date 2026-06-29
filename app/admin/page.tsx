'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle2, AlertTriangle, ExternalLink, ChevronRight, Building2, Shield, Clock } from 'lucide-react'
import { useAuth, authHeaders } from '@/lib/auth'
import { AppNav } from '@/components/layout/AppNav'
import { KpiCard } from '@/components/kpi/KpiCard'
import { MONTHS, getDefaultMonth, getDefaultYear } from '@/lib/status'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR]

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

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (user.role === 'dept_head') { router.push('/dept'); return }
    if (user.role === 'board') { router.push('/board'); return }
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

  // Fetch selected dept data
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
      toast.success(status === 'verified' ? 'KPI verified' : 'KPI flagged for correction')
    } catch {
      toast.error('Action failed')
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
      toast.error('Failed to dismiss')
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
    <div className="min-h-screen flex flex-col bg-[#F4F4F4]">
      <AppNav title="Corporate Planning" subtitle="Data Verification" />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-[#EBEBEB] shrink-0 overflow-y-auto hidden md:block">
          <div className="p-3 border-b border-[#F2F2F2]">
            <div className="text-[10px] font-medium text-[#AAAAAA] uppercase tracking-wider px-2 py-1">Departments</div>
          </div>
          <div className="py-2">
            {depts.map(d => (
              <button
                key={d.id}
                onClick={() => { setSelectedDept(d.id); setTab('data') }}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors ${
                  selectedDept === d.id ? 'bg-[#FEF2F2] text-[#CC1F1F]' : 'text-[#595959] hover:bg-[#FAFAFA]'
                }`}
              >
                <Building2 size={13} className="shrink-0" />
                <span className="text-xs font-normal flex-1 truncate">{d.name}</span>
                {d.submitted && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] shrink-0" title="Submitted" />
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Main panel */}
        <div className="flex-1 overflow-y-auto">
          {/* Mobile dept selector */}
          <div className="md:hidden bg-white border-b border-[#EBEBEB] px-4 py-2">
            <Select value={selectedDept || ''} onValueChange={v => { setSelectedDept(v); setTab('data') }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {depts.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!selectedDept ? (
            <div className="flex-1 flex flex-col items-center justify-center py-32 text-center">
              <Building2 size={32} className="text-[#DDDDDD] mb-4" />
              <div className="text-[#AAAAAA] text-sm">Select a department to review</div>
            </div>
          ) : (
            <>
              {/* Dept header + controls */}
              <div className="bg-white border-b border-[#EBEBEB] px-6 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-[#808080]">
                  <span className="font-medium text-[#1A1A1A]">{selectedDeptObj?.name}</span>
                  {selectedDeptObj?.submitted && (
                    <span className="flex items-center gap-1 text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0] px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={10} /> Submitted
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                    <SelectTrigger className="w-[120px] h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                    <SelectTrigger className="w-[80px] h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white border-b border-[#EBEBEB] px-6 flex gap-1">
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
                        : 'border-transparent text-[#808080] hover:text-[#595959]'
                    }`}
                  >
                    <t.icon size={12} />
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-6 max-w-4xl">
                {/* DATA TAB */}
                {tab === 'data' && (
                  <div className="space-y-3">
                    {loading ? (
                      [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white border border-[#EBEBEB] rounded-sm animate-pulse" />)
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
                          {/* Verification action row */}
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
                            ) : (
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
                                {dataSources[kpi.id]?.url && (
                                  <a
                                    href={dataSources[kpi.id].url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 text-[11px] text-[#808080] hover:text-[#CC1F1F] ml-auto"
                                  >
                                    <ExternalLink size={10} />
                                    Source
                                  </a>
                                )}
                              </>
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
                            className={`bg-white border border-[#EBEBEB] rounded-sm p-4 flex items-start gap-3 ${a.dismissed ? 'opacity-50' : ''}`}
                          >
                            <AlertTriangle size={14} className={a.dismissed ? 'text-[#DDDDDD]' : 'text-[#F59E0B]'} />
                            <div className="flex-1">
                              <div className="text-xs font-medium text-[#1A1A1A]">{kpis.find(k => k.id === a.kpi_id)?.name || 'Unknown KPI'}</div>
                              <div className="text-xs text-[#808080] mt-0.5 font-normal">{a.description}</div>
                              <div className="text-[10px] text-[#AAAAAA] mt-1 flex items-center gap-1">
                                <Clock size={9} />
                                {new Date(a.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            {!a.dismissed && (
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
                            <div key={kpi.id} className="bg-white border border-[#EBEBEB] rounded-sm px-4 py-3 flex items-center gap-3">
                              <div className="flex-1">
                                <div className="text-xs font-medium text-[#1A1A1A]">{kpi.name}</div>
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
