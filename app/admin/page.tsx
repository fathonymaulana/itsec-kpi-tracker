'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircleLineDuotone as CheckCircle2,
  DangerTriangleLineDuotone as AlertTriangle,
  AltArrowRightLineDuotone as ChevronRight, AltArrowRightBold as ChevronRightBold,
  BuildingsLineDuotone as Building2,
  ShieldLineDuotone as Shield, ShieldBold as ShieldBold,
  LockUnlockedLineDuotone as LockUnlocked, LockUnlockedBold as LockUnlockedBold,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { DateSidebar } from '@/components/kpi/DateSidebar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { AnimatedAside } from '@/components/layout/AnimatedAside'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { KpiCard } from '@/components/kpi/KpiCard'
import { getDefaultMonth, getDefaultYear, MONTHS } from '@/lib/status'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

const CURRENT_YEAR = new Date().getFullYear()

interface Dept { id: string; name: string; submitted: boolean }
interface SubMetric { id: number; name: string; unit: string; is_calculated: number; formula_key: string | null; calc_input_positions: string | null }
interface Kpi { id: number; name: string; target_text: string; numeric_target: number | null; direction: number; frequency?: string | null; sub_metrics: SubMetric[] }
interface Actual { id: number; sub_metric_id: number; kpi_id: number; value: number; data_source_url?: string; data_source_note?: string }
interface Verification { id: number; kpi_id: number; status: 'pending' | 'verified' | 'flagged'; note: string; verified_at: string }
interface ModifyRequest {
  id: number; kpi_id: number; dept_id: string; year: number; month: number
  reason: string; status: 'pending' | 'approved' | 'rejected'; requested_at: string
  kpi_name: string | null; dept_name: string | null; requested_by_name: string | null
}

type TabKey = 'data' | 'verifications' | 'modify'

export default function AdminPage() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [depts, setDepts] = useState<Dept[]>([])
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [month, setMonth] = useState(getDefaultMonth())
  const [year, setYear] = useState(getDefaultYear())
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [actuals, setActuals] = useState<Record<number, Actual>>({}) // smId → actual
  const [yearActuals, setYearActuals] = useState<Record<number, Record<number, number>>>({}) // month → smId → value
  const [dataSources, setDataSources] = useState<Record<number, { url: string; note: string }>>({}) // kpi_id → ds
  const [verifications, setVerifications] = useState<Verification[]>([])
  const [modifyRequests, setModifyRequests] = useState<ModifyRequest[]>([])
  const [tab, setTab] = useState<TabKey>('data')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rejectTarget, setRejectTarget] = useState<ModifyRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')

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
      const [kpiRes, actRes, verRes, yearActRes] = await Promise.all([
        fetch(`/api/departments/${selectedDept}/kpis`, { headers: authHeaders(token) }),
        fetch(`/api/actuals?dept_id=${selectedDept}&year=${year}&month=${month}`, { headers: authHeaders(token) }),
        fetch(`/api/verifications?dept_id=${selectedDept}&year=${year}&month=${month}`, { headers: authHeaders(token) }),
        // Whole year, independent of the month above — lets KpiCard sum a quarter/year's entries
        // for KPIs whose target isn't monthly (see lib/frequency.ts).
        fetch(`/api/actuals?dept_id=${selectedDept}&year=${year}`, { headers: authHeaders(token) }),
      ])
      const kpiData = await kpiRes.json()
      const actData = await actRes.json()
      const verData = await verRes.json()
      const yearActData = await yearActRes.json()

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
      setVerifications(verData.verifications || [])

      const byMonth: Record<number, Record<number, number>> = {}
      for (const a of (yearActData.actuals || [])) {
        if (!byMonth[a.month]) byMonth[a.month] = {}
        byMonth[a.month][a.sub_metric_id] = a.value
      }
      setYearActuals(byMonth)
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }, [token, selectedDept, year, month])

  useEffect(() => { if (selectedDept) fetchDeptData() }, [selectedDept, fetchDeptData])

  // Scoped to selectedDept when one is picked, same as the Data Review/Verifications tabs — shows
  // requests across every department only while nothing's selected yet.
  const fetchModifyRequests = useCallback(async () => {
    if (!token) return
    try {
      const qs = new URLSearchParams({ status: 'pending' })
      if (selectedDept) qs.set('dept_id', selectedDept)
      const r = await fetch(`/api/modify-requests?${qs.toString()}`, { headers: authHeaders(token) })
      const data = await r.json()
      setModifyRequests(data.requests || [])
    } catch { /* non-fatal */ }
  }, [token, selectedDept])

  useEffect(() => { if (user) fetchModifyRequests() }, [user, fetchModifyRequests])

  const handleReviewModify = async (id: number, action: 'approve' | 'reject', note = '') => {
    if (!token) return
    setActionLoading(id)
    try {
      const r = await fetch(`/api/modify-requests/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed')
      await fetchModifyRequests()
      if (selectedDept) await fetchDeptData()
      toast.success(
        action === 'approve' ? 'Month unlocked' : 'Request rejected',
        { description: action === 'approve' ? 'The department can edit and resubmit that month now.' : 'The department will see why this was declined.' }
      )
    } catch (err) {
      toast.error('That action didn’t go through', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setActionLoading(null)
    }
  }

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

  const valuesAsStrings: Record<number, string> = Object.fromEntries(
    Object.entries(actuals).map(([smId, a]) => [smId, String(a.value)])
  )

  const getKpiVerification = (kpiId: number) => verifications.find(v => v.kpi_id === kpiId)

  const selectedDeptObj = depts.find(d => d.id === selectedDept)
  const pendingVerifications = kpis.filter(k => !getKpiVerification(k.id)).length

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

        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">
                {canVerify ? 'Data Verification' : 'Data Review'}
              </h1>
              <p className="text-sm text-ink-muted mt-1">
                Pick a department to review its submitted KPIs and verify entries for the period.
              </p>
            </div>

            <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-4 mb-6 flex items-center gap-3 flex-wrap">
              <Select value={selectedDept || ''} onValueChange={v => { if (v) { setSelectedDept(v); setTab('data') } }}>
                <SelectTrigger className="w-full sm:w-[240px] !h-9 rounded-lg border-divider">
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
                <span className="flex items-center gap-1 text-xs text-success bg-success-soft border border-success-soft-border px-2.5 py-1 rounded-full">
                  <CheckCircle2 size={11} /> Submitted
                </span>
              )}
            </div>

            {/* Tabs — Modify Requests is global (any department), so it works with no department selected */}
            <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl px-2 flex gap-1 mb-4">
              {([
                { key: 'data', label: 'Data Review', icon: ChevronRight, boldIcon: ChevronRightBold },
                { key: 'verifications', label: `Verifications${pendingVerifications > 0 ? ` (${pendingVerifications})` : ''}`, icon: Shield, boldIcon: ShieldBold },
                { key: 'modify', label: `Modify Requests${modifyRequests.length > 0 ? ` (${modifyRequests.length})` : ''}`, icon: LockUnlocked, boldIcon: LockUnlockedBold },
              ] as { key: TabKey; label: string; icon: React.ElementType; boldIcon: React.ElementType }[]).map(t => {
                const Icon = tab === t.key ? t.boldIcon : t.icon
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 text-xs border-b-2 transition-colors ${
                      tab === t.key
                        ? 'border-[#CC1F1F] text-[#CC1F1F] font-medium'
                        : 'border-transparent text-ink-muted hover:text-ink-soft'
                    }`}
                  >
                    <Icon size={12} />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* MODIFY REQUESTS TAB */}
            {tab === 'modify' && (
              <div className="space-y-2">
                {modifyRequests.length === 0 ? (
                  <div className="text-center py-16 text-ink-faint text-sm">No pending modify requests.</div>
                ) : modifyRequests.map(r => (
                  <div key={r.id} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-ink">{r.kpi_name || 'Unknown KPI'}</div>
                        <div className="text-xs text-ink-muted mt-0.5">
                          {r.dept_name} · {MONTHS[r.month - 1]} {r.year} · requested by {r.requested_by_name || 'Unknown'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] gap-1 text-success border-success-soft-border hover:bg-success-soft"
                          disabled={actionLoading === r.id}
                          onClick={() => handleReviewModify(r.id, 'approve')}
                        >
                          <CheckCircle2 size={10} />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] gap-1 text-danger border-danger-soft-border hover:bg-danger-soft"
                          disabled={actionLoading === r.id}
                          onClick={() => { setRejectTarget(r); setRejectNote('') }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-ink-soft mt-2 bg-panel-soft rounded-lg p-3">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {tab !== 'modify' && !selectedDept ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <Building2 size={32} className="text-ink-faint mb-4" />
                <div className="text-ink-faint text-sm">Select a department to review</div>
              </div>
            ) : tab !== 'modify' && (
              <>
                {/* DATA TAB */}
                {tab === 'data' && (
                  <div className="space-y-3">
                    {loading ? (
                      [...Array(4)].map((_, i) => <div key={i} className="h-24 bg-panel border border-divider rounded-3xl animate-pulse" />)
                    ) : kpis.length === 0 ? (
                      <div className="text-center py-16 text-ink-faint text-sm">No data for this period.</div>
                    ) : kpis.map(kpi => {
                      const verification = getKpiVerification(kpi.id)
                      return (
                        <div key={kpi.id} className="space-y-1">
                          <KpiCard
                            kpi={kpi}
                            values={valuesAsStrings}
                            yearActuals={yearActuals}
                            month={month}
                            dataSource={dataSources[kpi.id]}
                            readOnly
                          />
                          {/* Verification status / action row */}
                          <div className="flex items-center gap-2 px-1">
                            {verification ? (
                              <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                                verification.status === 'verified'
                                  ? 'text-success bg-success-soft border border-success-soft-border'
                                  : 'text-danger bg-danger-soft border border-danger-soft-border'
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
                                  className="h-6 text-[11px] gap-1 text-success border-success-soft-border hover:bg-success-soft"
                                  disabled={actionLoading === kpi.id}
                                  onClick={() => handleVerify(kpi.id, 'verified')}
                                >
                                  <CheckCircle2 size={10} />
                                  Verify
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] gap-1 text-danger border-danger-soft-border hover:bg-danger-soft"
                                  disabled={actionLoading === kpi.id}
                                  onClick={() => handleVerify(kpi.id, 'flagged', 'Needs correction')}
                                >
                                  <AlertTriangle size={10} />
                                  Flag
                                </Button>
                              </>
                            ) : (
                              <span className="text-[11px] text-ink-faint">Pending verification</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* VERIFICATIONS TAB */}
                {tab === 'verifications' && (
                  <div>
                    {kpis.length === 0 ? (
                      <div className="text-center py-16 text-ink-faint text-sm">No KPIs loaded.</div>
                    ) : (
                      <div className="space-y-2">
                        {kpis.map(kpi => {
                          const v = getKpiVerification(kpi.id)
                          return (
                            <div key={kpi.id} className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl px-4 py-3 flex items-center gap-3">
                              <div className="flex-1">
                                <div className="text-xs font-medium text-ink">{kpi.name}</div>
                                <div className="text-[11px] text-ink-faint mt-0.5 font-normal">{kpi.target_text}</div>
                              </div>
                              {v ? (
                                <div className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full ${
                                  v.status === 'verified'
                                    ? 'text-success bg-success-soft'
                                    : 'text-danger bg-danger-soft'
                                }`}>
                                  {v.status === 'verified' ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                                  <span className="capitalize">{v.status}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-ink-faint">Pending</span>
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

        <AnimatedAside open={rightPanelOpen} width={400} side="right" className="hidden lg:block" contentClassName="overflow-y-auto">
          <AddOnsPanel />
        </AnimatedAside>
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject — {rejectTarget?.kpi_name}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-xs text-ink-muted mb-3">Let {rejectTarget?.dept_name} know why this month stays locked.</p>
            <label className="block text-xs font-medium text-ink-soft mb-1.5">Reason</label>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="e.g. The current figures already match the source — no change needed."
              rows={3}
              className="w-full rounded-lg border border-divider text-sm p-3 resize-none focus:outline-none focus:border-[#CC1F1F]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              disabled={!rejectNote.trim() || actionLoading === rejectTarget?.id}
              onClick={() => { if (rejectTarget) { handleReviewModify(rejectTarget.id, 'reject', rejectNote.trim()); setRejectTarget(null) } }}
              className="bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white"
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
