'use client'
import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DangerCircleLineDuotone as AlertCircle } from '@solar-icons/react-perf'
import { ItsecLogo } from '@/components/layout/ItsecLogo'
import { cn } from '@/lib/utils'

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
      // Intentionally leave `loading` true here instead of a `finally` — this component unmounts
      // once the route change lands, so resetting it on success would only be visible as a flash
      // back to "Sign in" in the moment before that happens. Only the failure path resets it, so
      // the CTA stays in "Signing in…" continuously until the destination page opens or an error surfaces.
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  const formFilled = !!selected && pin.length === 4

  return (
    // `relative z-0` (not just `relative`) is required here: without an explicit z-index, this div
    // never becomes a stacking context of its own, so the -z-10 wordmark image below escapes to the
    // page's root stacking context instead and paints behind the <body> background — invisible.
    <div className="h-screen overflow-hidden bg-white dark:bg-[#141414] flex flex-col relative z-0">
      {/* Decorative wordmark banner, pinned to the very top of the page — behind every other
          element (-z-10) so the login form always reads on top of it. Purely visual/non-interactive.
          h-[45vh] matches the reference design: the band covers roughly the top ~45% of the
          viewport, with the form card's (vertically-centered) top edge overlapping into its lower
          portion rather than sitting entirely below it — a viewport-relative unit, not a fixed px
          step per breakpoint, so the proportion holds at any screen size. object-contain (not
          object-cover) keeps it "never cropped" per the standing requirement: cover always fills the
          box by slicing off whatever overflows; contain scales the whole image to fit within the box
          instead — on a box narrower than the image's own 3.5:1 ratio that leaves transparent
          letterboxing on the sides, invisible against the page's own matching background, so there's
          no visible cost to guaranteeing the full graphic stays intact. object-top keeps it flush
          against the very top of the page on box ratios where the letterboxing lands top/bottom
          instead. dark:invert flips the artwork's black strokes to white (and vice versa) for dark
          mode — the source PNG has no separate dark variant, so this is a CSS filter instead;
          invert() only touches RGB channels, so the transparent background is unaffected. */}
      <div className="absolute inset-x-0 top-0 h-[45vh] -z-10 overflow-hidden pointer-events-none select-none">
        <Image
          src="/login-wordmark.png"
          alt=""
          fill
          priority
          className="object-contain object-top dark:invert"
        />
      </div>

      {/* Centered content */}
      <div className="flex-1 min-h-0 flex items-center justify-center gap-10 lg:gap-[120px] px-6 py-6 overflow-y-auto relative">
        {/* Form card, standalone — no headline above it, per the whitespace-first layout */}
        <div className="flex flex-col gap-6 items-start w-full max-w-[373px] shrink-0">
          <div className="bg-panel border border-divider shadow-2xl rounded-3xl w-full p-8 flex flex-col gap-6">
            <ItsecLogo className="h-5 w-auto text-ink self-center" />
            <p className="text-[20px] font-semibold text-ink self-center">Sign in to your account</p>
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
                <p className="text-[12.8px] text-ink-muted leading-5">Choose the department or role that best fits your position.</p>
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
                <div className="flex items-center gap-2 text-[#CC1F1F] text-sm bg-danger-soft border border-danger-soft-border px-3 py-2 rounded-lg w-full">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={!selected || pin.length !== 4 || loading}
                className={cn(
                  // bg-primary (not a fixed hex) so this correctly inverts in dark mode — near-black
                  // fill/near-white text in light mode, near-white fill/near-black text in dark mode.
                  // disabled:bg-primary keeps the fill solid either way; only the text swaps between
                  // muted-foreground and primary-foreground, both of which stay correctly paired with
                  // whichever fill color --primary resolves to in the current theme.
                  'w-full h-12 rounded-2xl bg-primary hover:bg-primary/80 font-medium gap-2 disabled:opacity-100 disabled:bg-primary',
                  formFilled ? 'text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                {loading && <Spinner className="size-4" />}
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
