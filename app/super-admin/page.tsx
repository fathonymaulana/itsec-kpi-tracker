'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  UserPlusLineDuotone as IconUserPlus,
  ShieldCheckLineDuotone as IconShieldCheck,
  KeyLineDuotone as IconKey,
  KeyBold as IconKeyBold,
  PenBold as IconPen,
  CheckCircleLineDuotone as IconCheckCircle,
  CloseCircleLineDuotone as IconCloseCircle,
  ClockCircleLineDuotone as IconClock,
  UsersGroupRoundedLineDuotone as UsersLine, UsersGroupRoundedBold as UsersBold,
  KeyBold as KeyBold,
  MenuDotsBold as IconMenuDots,
  UserCrossBold as IconUserCross,
  UserCheckBold as IconUserCheck,
  ShieldKeyholeLineDuotone as IconShieldKeyhole,
  TuningLineDuotone as IconFilters,
  DownloadLineDuotone as IconDownload,
} from '@solar-icons/react-perf'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { AnimatedAside } from '@/components/layout/AnimatedAside'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { iconHoverClass, cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

type Role = 'dept_head' | 'corp_planning'
interface AdminUser { id: number; name: string; avatar_url: string | null; role: Role; dept_id: string | null; dept_name: string | null; active: boolean; created_at: string }
interface PinRequest { id: number; status: 'pending' | 'approved' | 'rejected'; requested_at: string; user: { id: number; name: string; role: Role; dept_id: string | null } }
interface Dept { id: string; name: string }

const ROLE_LABELS: Record<Role, string> = { dept_head: 'Department Head', corp_planning: 'Corporate Planning' }

export default function SuperAdminPage() {
  const { user, token, ready } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<'users' | 'requests'>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [requests, setRequests] = useState<PinRequest[]>([])
  const [depts, setDepts] = useState<Dept[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dialogUser, setDialogUser] = useState<AdminUser | 'new' | null>(null)
  const [resetPinFor, setResetPinFor] = useState<AdminUser | null>(null)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  useEffect(() => {
    if (!ready) return
    if (!user) { router.push('/login'); return }
    if (user.role !== 'corp_planning') { router.push('/login'); return }
  }, [user, router, ready])

  const fetchAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [uRes, rRes, dRes] = await Promise.all([
        fetch('/api/super-admin/users', { headers: authHeaders(token) }),
        fetch('/api/super-admin/pin-requests', { headers: authHeaders(token) }),
        fetch('/api/departments', { headers: authHeaders(token) }),
      ])
      setUsers((await uRes.json()).users || [])
      setRequests((await rRes.json()).requests || [])
      setDepts((await dRes.json()).departments || [])
    } catch { toast.error('Couldn’t load the dashboard', { description: 'Please refresh the page.' }) }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { if (user?.role === 'corp_planning') fetchAll() }, [user, fetchAll])

  const handleReview = async (id: number, action: 'approve' | 'reject') => {
    if (!token) return
    try {
      const r = await fetch(`/api/super-admin/pin-requests/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!r.ok) throw new Error()
      await fetchAll()
      toast.success(
        action === 'approve' ? 'PIN change approved' : 'PIN change rejected',
        { description: action === 'approve' ? 'Their new PIN is active immediately.' : 'They’ll need to submit a new request.' }
      )
    } catch { toast.error('That action didn’t go through', { description: 'Please try again.' }) }
  }

  const handleToggleActive = async (u: AdminUser) => {
    if (!token) return
    try {
      const r = await fetch(`/api/super-admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !u.active }),
      })
      if (!r.ok) throw new Error()
      await fetchAll()
      toast.success(u.active ? `${u.name} deactivated` : `${u.name} reactivated`, {
        description: u.active ? 'They can no longer sign in.' : 'They can sign in again with their existing PIN.',
      })
    } catch { toast.error('That action didn’t go through', { description: 'Please try again.' }) }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const filteredUsers = users.filter(u => {
    const matchesSearch = !search.trim() || u.name.toLowerCase().includes(search.toLowerCase()) || (u.dept_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? u.active : !u.active)
    return matchesSearch && matchesRole && matchesStatus
  })
  const activeFilterCount = (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)

  // Exports exactly what's currently visible (respecting search + filters) — dynamically imported
  // so the exceljs bundle (only needed for this one action) never ships in the main page chunk.
  const handleExportXlsx = async () => {
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'ITSEC KPI Tracker'
      wb.created = new Date()
      const ws = wb.addWorksheet('Users')
      ws.columns = [
        { header: 'Name', key: 'name', width: 28 },
        { header: 'Role', key: 'role', width: 20 },
        { header: 'Department', key: 'dept', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
      ]
      filteredUsers.forEach(u => ws.addRow({
        name: u.name,
        role: ROLE_LABELS[u.role],
        dept: u.dept_name || '—',
        status: u.active ? 'Active' : 'Inactive',
      }))
      ws.getRow(1).font = { bold: true }
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `itsec-kpi-tracker-users-${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export ready', { description: `${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'} exported to XLSX.` })
    } catch {
      toast.error('Couldn’t export that', { description: 'Please try again.' })
    } finally {
      setExporting(false)
    }
  }

  if (!ready || !user || user.role !== 'corp_planning') return <PageSkeleton leftAside={false} />

  return (
    <div className="h-screen flex flex-col bg-app overflow-hidden">
      <DeptTopNav rightPanelOpen={rightPanelOpen} onToggleRightPanel={() => setRightPanelOpen(v => !v)} />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Users</h1>
              <p className="text-sm text-ink-muted mt-1">Manage every account across departments, and review PIN change requests.</p>
            </div>

            <Tabs value={tab} onValueChange={v => v && setTab(v as 'users' | 'requests')}>
              {/* Row 1: tabs alone. Row 2: search (left) and the action group (right), justified
                  apart — sized and typeset to match the reference (h-10, text-sm throughout). */}
              <TabsList variant="line" className="mb-4">
                <TabsTrigger value="users">
                  {tab === 'users' ? <UsersBold data-icon="inline-start" size={14} /> : <UsersLine data-icon="inline-start" size={14} />}
                  Users
                </TabsTrigger>
                <TabsTrigger value="requests">
                  {tab === 'requests' ? <KeyBold data-icon="inline-start" size={14} /> : <IconKey data-icon="inline-start" size={14} />}
                  PIN Requests{pendingCount > 0 && <Badge className="ml-1.5 text-[10px] px-1.5">{pendingCount}</Badge>}
                </TabsTrigger>
              </TabsList>

              {tab === 'users' && (
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <Input
                    placeholder="Search users…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-10 w-full max-w-xs rounded-lg border-divider text-sm"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className={cn(
                          'inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-divider bg-panel text-sm font-medium text-ink hover:bg-panel-soft transition-colors',
                          iconHoverClass
                        )}
                      >
                        <IconFilters size={15} />
                        Filters
                        {activeFilterCount > 0 && <Badge className="ml-0.5 text-[10px] px-1.5">{activeFilterCount}</Badge>}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Role</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={roleFilter} onValueChange={v => setRoleFilter(v as typeof roleFilter)}>
                          <DropdownMenuRadioItem value="all">All roles</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="dept_head">Department Head</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="corp_planning">Corporate Planning</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Status</DropdownMenuLabel>
                        <DropdownMenuRadioGroup value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
                          <DropdownMenuRadioItem value="all">All statuses</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="active">Active</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="inactive">Inactive</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        {activeFilterCount > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setRoleFilter('all'); setStatusFilter('all') }}>
                              Clear filters
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      variant="outline"
                      disabled={exporting || filteredUsers.length === 0}
                      className={cn('h-10 px-4 rounded-lg border-divider text-sm font-medium text-ink', iconHoverClass)}
                      onClick={handleExportXlsx}
                    >
                      <IconDownload size={15} className="mr-1.5" />
                      {exporting ? 'Exporting…' : 'Export XLSX'}
                    </Button>
                    <Button
                      className={cn('h-10 px-4 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-medium', iconHoverClass)}
                      onClick={() => setDialogUser('new')}
                    >
                      <IconUserPlus size={15} className="mr-1.5" />
                      Add User
                    </Button>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="h-64 bg-panel border border-divider rounded-3xl animate-pulse" />
              ) : (
                <>
                  <TabsContent value="users">
                    {/* Mobile/tablet: one card per user, matching the Figma "Table Card Responsive"
                        pattern used everywhere else — muted header (identity + actions), one
                        divided label/value row per attribute. The 5-column table below stays
                        desktop-only, since squeezing role/department/status/actions into a table
                        row at narrow widths reads far worse than a stacked card. */}
                    <div className="flex md:hidden flex-col gap-3">
                      {filteredUsers.map(u => (
                        <div key={u.id} className="bg-panel border border-divider rounded-3xl overflow-hidden">
                          <div className="bg-panel-soft flex items-center justify-between px-6 py-4 gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar size="sm">
                                {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.name} />}
                                <AvatarFallback className="text-[10px]">{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex flex-col gap-1.5">
                                <span className="text-[10px] text-ink-faint">User</span>
                                <span className="text-sm font-medium text-ink truncate">{u.name}</span>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className={`flex items-center gap-2 h-8 px-3 rounded-md bg-panel border border-divider shadow-xs text-sm font-medium text-ink shrink-0 ${iconHoverClass}`}
                                title="Actions"
                              >
                                <IconMenuDots size={16} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setDialogUser(u)}>
                                  <IconPen size={14} /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setResetPinFor(u)}>
                                  <IconKeyBold size={14} /> Reset PIN
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant={u.active ? 'destructive' : 'default'} onClick={() => handleToggleActive(u)}>
                                  {u.active ? <IconUserCross size={14} /> : <IconUserCheck size={14} />}
                                  {u.active ? 'Deactivate' : 'Reactivate'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex items-center justify-between border-t border-divider">
                            <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">Role</span>
                            <span className="flex-1 py-3 text-sm font-medium text-ink text-center">{ROLE_LABELS[u.role]}</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-divider">
                            <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">Department</span>
                            <span className="flex-1 py-3 text-sm font-medium text-ink text-center">{u.dept_name || '—'}</span>
                          </div>
                          <div className="flex items-center justify-between border-t border-divider">
                            <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">Status</span>
                            <div className="flex-1 py-3 flex justify-center">
                              <Label className="gap-1.5 text-[10px]" style={{ color: u.active ? 'var(--success-text)' : 'var(--danger-text)' }}>
                                <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} />
                                {u.active ? 'Active' : 'Inactive'}
                              </Label>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden md:block bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredUsers.map(u => (
                            <TableRow key={u.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar size="sm">
                                    {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.name} />}
                                    <AvatarFallback className="text-[10px]">{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{u.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{ROLE_LABELS[u.role]}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{u.dept_name || '—'}</TableCell>
                              <TableCell>
                                <Label className="gap-1.5 text-xs" style={{ color: u.active ? 'var(--success-text)' : 'var(--danger-text)' }}>
                                  <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} />
                                  {u.active ? 'Active' : 'Inactive'}
                                </Label>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger
                                    className={`inline-flex size-7 items-center justify-center rounded-md hover:bg-muted transition-colors ${iconHoverClass}`}
                                    title="Actions"
                                  >
                                    <IconMenuDots size={16} className="text-ink-muted" />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setDialogUser(u)}>
                                      <IconPen size={14} /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setResetPinFor(u)}>
                                      <IconKeyBold size={14} /> Reset PIN
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant={u.active ? 'destructive' : 'default'} onClick={() => handleToggleActive(u)}>
                                      {u.active ? <IconUserCross size={14} /> : <IconUserCheck size={14} />}
                                      {u.active ? 'Deactivate' : 'Reactivate'}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="requests">
                    {requests.length > 0 && (
                      <div className="flex md:hidden flex-col gap-3 mb-3">
                        {requests.map(r => (
                          <div key={r.id} className="bg-panel border border-divider rounded-3xl overflow-hidden">
                            <div className="bg-panel-soft flex items-center justify-between px-6 py-4 gap-3">
                              <div className="min-w-0 flex flex-col gap-1.5">
                                <span className="text-[10px] text-ink-faint">User</span>
                                <span className="text-sm font-medium text-ink truncate">{r.user?.name || 'Unknown'}</span>
                              </div>
                              {r.status === 'pending' && <Badge className="text-[10px] gap-1 shrink-0"><IconClock size={10} /> Pending</Badge>}
                              {r.status === 'approved' && <Badge variant="default" className="text-[10px] gap-1 shrink-0"><IconCheckCircle size={10} /> Approved</Badge>}
                              {r.status === 'rejected' && <Badge variant="destructive" className="text-[10px] gap-1 shrink-0"><IconCloseCircle size={10} /> Rejected</Badge>}
                            </div>
                            <div className="flex items-center justify-between border-t border-divider">
                              <span className="flex-1 pl-6 py-3 text-xs text-ink-faint">Requested</span>
                              <span className="flex-1 py-3 text-sm font-medium text-ink text-center">{new Date(r.requested_at).toLocaleString()}</span>
                            </div>
                            {r.status === 'pending' && (
                              <div className="border-t border-divider flex items-center gap-2 px-6 py-4">
                                <Button size="sm" variant="outline" className="h-8 flex-1 text-xs text-success border-success-soft-border hover:bg-success-soft" onClick={() => handleReview(r.id, 'approve')}>
                                  <IconShieldCheck size={12} className="mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 flex-1 text-xs text-danger border-danger-soft-border hover:bg-danger-soft" onClick={() => handleReview(r.id, 'reject')}>
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="hidden md:block bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden">
                      {requests.length === 0 ? (
                        <EmptyState
                          icon={IconShieldKeyhole}
                          title="No PIN change requests"
                          description="When someone submits a new PIN from their profile, it'll show up here for approval."
                        />
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>User</TableHead>
                              <TableHead>Requested</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {requests.map(r => (
                              <TableRow key={r.id}>
                                <TableCell className="text-sm">{r.user?.name || 'Unknown'}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleString()}</TableCell>
                                <TableCell>
                                  {r.status === 'pending' && <Badge className="text-[10px] gap-1"><IconClock size={10} /> Pending</Badge>}
                                  {r.status === 'approved' && <Badge variant="default" className="text-[10px] gap-1"><IconCheckCircle size={10} /> Approved</Badge>}
                                  {r.status === 'rejected' && <Badge variant="destructive" className="text-[10px] gap-1"><IconCloseCircle size={10} /> Rejected</Badge>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {r.status === 'pending' && (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button size="sm" variant="outline" className="h-6 text-[11px] text-success border-success-soft-border hover:bg-success-soft" onClick={() => handleReview(r.id, 'approve')}>
                                        <IconShieldCheck size={11} className="mr-1" /> Approve
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-6 text-[11px] text-danger border-danger-soft-border hover:bg-danger-soft" onClick={() => handleReview(r.id, 'reject')}>
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  </TabsContent>
                </>
              )}
            </Tabs>
          </div>
        </main>

        <AnimatedAside open={rightPanelOpen} width={400} side="right" className="hidden lg:block" contentClassName="overflow-y-auto">
          <AddOnsPanel />
        </AnimatedAside>
      </div>

      {dialogUser && (
        <UserFormDialog
          initial={dialogUser === 'new' ? null : dialogUser}
          depts={depts}
          token={token}
          onClose={() => setDialogUser(null)}
          onSaved={() => { setDialogUser(null); fetchAll() }}
        />
      )}
      {resetPinFor && (
        <ResetPinDialog
          targetUser={resetPinFor}
          token={token}
          onClose={() => setResetPinFor(null)}
          onSaved={() => { setResetPinFor(null); fetchAll() }}
        />
      )}
    </div>
  )
}

function UserFormDialog({ initial, depts, token, onClose, onSaved }: {
  initial: AdminUser | null
  depts: Dept[]
  token: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [role, setRole] = useState<Role>(initial?.role || 'dept_head')
  const [deptId, setDeptId] = useState(initial?.dept_id || '')
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  // Starts open, flips to false on any dismiss gesture — the parent only actually unmounts this
  // component (via onClose, wired to onOpenChangeComplete below) once Dialog's GSAP exit tween has
  // played, rather than the instant a Cancel click or Escape press fires.
  const [open, setOpen] = useState(true)
  const isDirty = pin.length > 0 || name.trim() !== (initial?.name || '') || role !== (initial?.role || 'dept_head') || deptId !== (initial?.dept_id || '')
  const handleCancel = () => { if (isDirty) setConfirmDiscard(true); else setOpen(false) }

  const handleSubmit = async () => {
    if (!token || !name.trim()) return
    if (role === 'dept_head' && !deptId) { toast.error('Select a department'); return }
    if (!initial && pin.length !== 4) { toast.error('Enter a 4-digit initial PIN'); return }
    setSaving(true)
    try {
      const url = initial ? `/api/super-admin/users/${initial.id}` : '/api/super-admin/users'
      const body = initial
        ? { name: name.trim(), role, dept_id: role === 'dept_head' ? deptId : null }
        : { name: name.trim(), role, dept_id: role === 'dept_head' ? deptId : null, pin }
      const r = await fetch(url, {
        method: initial ? 'PATCH' : 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Save failed')
      toast.success(
        initial ? 'Changes saved' : `${name.trim()} added`,
        { description: initial ? undefined : 'They can sign in with the PIN you set.' }
      )
      onSaved()
    } catch (err) {
      toast.error('Couldn’t save that user', { description: err instanceof Error ? err.message : 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && setOpen(false)} onOpenChangeComplete={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit User' : 'Add User'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1.5">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-soft mb-1.5">Role</label>
            <Select value={role} onValueChange={v => v && setRole(v as Role)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as Role[]).map(r => (
                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === 'dept_head' && (
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1.5">Department</label>
              <Select value={deptId} onValueChange={v => v && setDeptId(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {depts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {!initial && (
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1.5">Initial 4-Digit PIN</label>
              <Input
                type="password" inputMode="numeric" maxLength={4}
                value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •" className="text-center tracking-widest"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button disabled={saving} onClick={handleSubmit} className="bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white">
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard changes?"
        description="What you've entered here hasn't been saved yet."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => setOpen(false)}
      />
    </Dialog>
  )
}

function ResetPinDialog({ targetUser, token, onClose, onSaved }: {
  targetUser: AdminUser
  token: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [open, setOpen] = useState(true)
  const handleCancel = () => { if (pin.length > 0) setConfirmDiscard(true); else setOpen(false) }

  const handleSubmit = async () => {
    if (!token || pin.length !== 4) return
    setSaving(true)
    try {
      const r = await fetch(`/api/super-admin/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_pin: pin }),
      })
      if (!r.ok) throw new Error()
      toast.success(`PIN reset for ${targetUser.name}`, { description: 'Effective immediately — share the new PIN with them directly.' })
      onSaved()
    } catch {
      toast.error('Couldn’t reset that PIN', { description: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && setOpen(false)} onOpenChangeComplete={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset PIN — {targetUser.name}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <p className="text-xs text-ink-muted mb-3">This takes effect immediately, bypassing the approval flow — use it when a user is locked out.</p>
          <label className="block text-xs font-medium text-ink-soft mb-1.5">New 4-Digit PIN</label>
          <Input
            type="password" inputMode="numeric" maxLength={4}
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="• • • •" className="text-center tracking-widest"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button disabled={saving || pin.length !== 4} onClick={handleSubmit} className="bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white">
            {saving ? 'Saving…' : 'Reset PIN'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard the new PIN?"
        description="The PIN you typed won't be saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => setOpen(false)}
      />
    </Dialog>
  )
}
