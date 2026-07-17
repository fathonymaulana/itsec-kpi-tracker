'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  UserPlusLineDuotone as IconUserPlus,
  ShieldCheckLineDuotone as IconShieldCheck,
  KeyLineDuotone as IconKey,
  PenLineDuotone as IconPen,
  CheckCircleLineDuotone as IconCheckCircle,
  CloseCircleLineDuotone as IconCloseCircle,
  ClockCircleLineDuotone as IconClock,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { DeptTopNav } from '@/components/layout/DeptTopNav'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { iconHoverClass } from '@/lib/utils'
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
  const filteredUsers = users.filter(u =>
    !search.trim() || u.name.toLowerCase().includes(search.toLowerCase()) || (u.dept_name || '').toLowerCase().includes(search.toLowerCase())
  )

  if (!ready || !user || user.role !== 'corp_planning') return null

  return (
    <div className="h-screen flex flex-col bg-app overflow-hidden">
      <DeptTopNav rightPanelOpen={rightPanelOpen} onToggleRightPanel={() => setRightPanelOpen(v => !v)} />

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-semibold text-ink tracking-[-0.6px]">Users</h1>
                <p className="text-sm text-ink-muted mt-1">Manage every account across departments, and review PIN change requests.</p>
              </div>
              {tab === 'users' && (
                <div className="flex items-center gap-2 shrink-0">
                  <Input placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} className="h-9 w-56 rounded-lg border-divider" />
                  <Button size="sm" className={`h-9 rounded-lg bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white ${iconHoverClass}`} onClick={() => setDialogUser('new')}>
                    <IconUserPlus size={14} className="mr-1" />
                    Add User
                  </Button>
                </div>
              )}
            </div>

            <Tabs value={tab} onValueChange={v => v && setTab(v as 'users' | 'requests')}>
              <TabsList className="mb-4">
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="requests">
                  PIN Requests{pendingCount > 0 && <Badge className="ml-1.5 text-[10px] px-1.5">{pendingCount}</Badge>}
                </TabsTrigger>
              </TabsList>

              {loading ? (
                <div className="h-64 bg-panel border border-divider rounded-3xl animate-pulse" />
              ) : (
                <>
                  <TabsContent value="users">
                    <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden">
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
                                <Badge variant={u.active ? 'default' : 'destructive'} className="text-[10px]">
                                  {u.active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => setDialogUser(u)}>
                                    <IconPen size={11} className="mr-1" /> Edit
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => setResetPinFor(u)}>
                                    <IconKey size={11} className="mr-1" /> Reset PIN
                                  </Button>
                                  <Button
                                    size="sm" variant="outline"
                                    className={`h-6 text-[11px] ${u.active ? 'text-danger border-danger-soft-border hover:bg-danger-soft' : 'text-success border-success-soft-border hover:bg-success-soft'}`}
                                    onClick={() => handleToggleActive(u)}
                                  >
                                    {u.active ? 'Deactivate' : 'Reactivate'}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="requests">
                    <div className="bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden">
                      {requests.length === 0 ? (
                        <div className="text-center py-16 text-ink-faint text-sm">No PIN change requests.</div>
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

        {rightPanelOpen && (
          <aside className="hidden lg:block w-[400px] shrink-0 overflow-y-auto">
            <AddOnsPanel />
          </aside>
        )}
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
  const isDirty = pin.length > 0 || name.trim() !== (initial?.name || '') || role !== (initial?.role || 'dept_head') || deptId !== (initial?.dept_id || '')
  const handleCancel = () => { if (isDirty) setConfirmDiscard(true); else onClose() }

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
    <Dialog open onOpenChange={o => !o && onClose()}>
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
        onConfirm={onClose}
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
  const handleCancel = () => { if (pin.length > 0) setConfirmDiscard(true); else onClose() }

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
    <Dialog open onOpenChange={o => !o && onClose()}>
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
        onConfirm={onClose}
      />
    </Dialog>
  )
}
