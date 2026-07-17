'use client'
import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DangerCircleLineDuotone as AlertCircle } from '@solar-icons/react-perf'

interface DirectoryUser {
  id: number
  name: string
  role: 'dept_head' | 'corp_planning'
  dept_id: string | null
  dept_name: string | null
}

const ROLE_LABELS: Record<string, string> = {
  corp_planning: 'Corporate Planning',
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const { login } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectId = searchParams.get('user')
  const [directory, setDirectory] = useState<DirectoryUser[]>([])
  const [selected, setSelected] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/users/directory')
      .then(r => r.json())
      .then(data => {
        setDirectory(data.users || [])
        if (preselectId) setSelected(preselectId)
      })
      .catch(() => setError('Failed to load users. Please refresh.'))
  }, [preselectId])

  const preselectedUser = directory.find(u => String(u.id) === preselectId)

  const management = directory.filter(u => u.role !== 'dept_head')
  const byDept = directory.filter(u => u.role === 'dept_head').reduce<Record<string, DirectoryUser[]>>((acc, u) => {
    const key = u.dept_name || 'Unassigned'
    ;(acc[key] ??= []).push(u)
    return acc
  }, {})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected || pin.length !== 4) return
    setLoading(true)
    setError('')
    try {
      await login(parseInt(selected, 10), pin)
      const stored = JSON.parse(localStorage.getItem('itsec_kpi_user') || '{}')
      const role = stored.role
      if (role === 'dept_head') router.push('/dept')
      else router.push('/admin')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-app flex flex-col relative">
      {/* Decorative wordmark ribbon, bleeding off both edges — echoes the woven brand band on
          Instagram/Threads' sign-in screen, re-lettered for this product. Purely visual, so it
          sits absolutely positioned above the flow and never affects the no-scroll layout below. */}
      <div className="absolute -top-8 md:-top-10 left-0 right-0 h-32 md:h-40 overflow-hidden pointer-events-none select-none -rotate-3 opacity-[0.07]">
        <div className="flex whitespace-nowrap text-ink font-extrabold text-4xl md:text-6xl tracking-tight leading-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="mx-8 shrink-0">KPI TRACKER · </span>
          ))}
        </div>
      </div>
      <div className="absolute top-2 md:top-4 left-0 right-0 h-32 md:h-40 overflow-hidden pointer-events-none select-none rotate-2 opacity-[0.05]">
        <div className="flex whitespace-nowrap text-ink font-extrabold text-4xl md:text-6xl tracking-tight leading-none">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="mx-8 shrink-0">KPI TRACKER · </span>
          ))}
        </div>
      </div>

      {/* Centered content */}
      <div className="flex-1 min-h-0 flex items-center justify-center gap-10 lg:gap-[120px] px-6 py-6 overflow-y-auto relative">
        {/* Form card, standalone — no headline above it, per the whitespace-first layout */}
        <div className="flex flex-col gap-6 items-start w-full max-w-[373px] shrink-0">
          <div className="bg-panel border border-divider shadow-2xl rounded-3xl w-full p-8 flex flex-col gap-6">
            <form onSubmit={handleSubmit} className="contents">
              {preselectedUser && (
                <p className="text-ink-muted text-sm leading-6 tracking-[-0.192px] text-center w-full -mb-2">
                  Switching to <span className="font-medium text-ink">{preselectedUser.name}</span> — enter their PIN to continue.
                </p>
              )}

              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-ink">Department / Role</label>
                <Select value={selected} onValueChange={v => setSelected(v ?? '')}>
                  <SelectTrigger className="w-full !h-9 rounded-lg border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-sm text-ink-muted">
                    <SelectValue placeholder="Select your department or role">
                      {(value: string | null) => {
                        if (!value) return 'Select your department or role'
                        const u = directory.find(d => String(d.id) === value)
                        if (!u) return value
                        return u.role === 'dept_head' ? u.name : `${u.name} — ${ROLE_LABELS[u.role]}`
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {management.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[10px] text-ink-faint uppercase tracking-wider">Management</SelectLabel>
                        {management.map(u => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-sm">
                            {u.name} <span className="text-ink-faint">— {ROLE_LABELS[u.role]}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {Object.entries(byDept).map(([deptName, users]) => (
                      <SelectGroup key={deptName}>
                        <SelectLabel className="text-[10px] text-ink-faint uppercase tracking-wider">{deptName}</SelectLabel>
                        {users.map(u => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-sm">{u.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-ink-muted leading-5">Choose the department or role that best fits your position.</p>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-ink">4-Digit PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="• • • •"
                  className="h-9 rounded-lg border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-center text-lg tracking-widest"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-[#CC1F1F] text-sm bg-danger-soft border border-[#F5A8A8] px-3 py-2 rounded-lg w-full">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={!selected || pin.length !== 4 || loading}
                className="w-full h-12 rounded-2xl bg-[#282828] hover:bg-[#171717] text-white font-medium"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="text-ink-muted text-[10px] leading-4 text-center w-full">
              Contact Corporate Planning if you have forgotten your PIN.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 pb-5 flex items-center justify-center gap-2 text-xs text-ink-faint relative">
        <span>© {new Date().getFullYear()} ITSEC KPI Tracker</span>
        <span aria-hidden>·</span>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-ink-muted transition-colors">
          Privacy Policy
        </a>
        <span aria-hidden>·</span>
        <a href="/cookies" target="_blank" rel="noopener noreferrer" className="hover:text-ink-muted transition-colors">
          Cookie Policy
        </a>
      </div>
    </div>
  )
}
