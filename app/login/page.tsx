'use client'
import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DangerCircleLinear as AlertCircle } from '@solar-icons/react-perf'

interface DirectoryUser {
  id: number
  name: string
  role: 'dept_head' | 'corp_planning' | 'super_admin'
  dept_id: string | null
  dept_name: string | null
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
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
      else if (role === 'corp_planning') router.push('/admin')
      else router.push('/super-admin')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#fafafa] flex flex-col">
      {/* Logo badge, top-left */}
      <div className="px-6 md:px-24 pt-4 pb-2 shrink-0">
        <Image src="/login/itsec-logo-badge.svg" alt="ITSEC KPI Tracker" width={179} height={19} className="h-5 w-auto" priority />
      </div>

      {/* Centered content */}
      <div className="flex-1 min-h-0 flex items-center justify-center gap-10 lg:gap-[120px] px-6 pb-6 overflow-y-auto">
        {/* Left: heading + form */}
        <div className="flex flex-col gap-6 items-start w-full max-w-[373px] shrink-0">
          <h1 className="text-[#282828] text-4xl lg:text-[60px] leading-[1.1] lg:leading-[76px] tracking-[-0.72px] text-center w-full font-normal">
            Performance Highlights
          </h1>
          <p className="text-[#737373] text-base leading-6 tracking-[-0.192px] text-center w-full">
            {preselectedUser
              ? <>Switching to <span className="font-medium text-[#282828]">{preselectedUser.name}</span> — enter their PIN to continue.</>
              : 'Track your IT security goals with precision'}
          </p>

          <div className="bg-white border border-[#e5e5e5] shadow-2xl rounded-3xl w-full p-8 flex flex-col gap-6">
            <form onSubmit={handleSubmit} className="contents">
              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-[#282828]">Department / Role</label>
                <Select value={selected} onValueChange={v => setSelected(v ?? '')}>
                  <SelectTrigger className="w-full !h-9 rounded-lg border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-sm text-[#737373]">
                    <SelectValue placeholder="Select your department or role" />
                  </SelectTrigger>
                  <SelectContent>
                    {management.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-[10px] text-[#AAAAAA] uppercase tracking-wider">Management</SelectLabel>
                        {management.map(u => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-sm">
                            {u.name} <span className="text-[#AAAAAA]">— {ROLE_LABELS[u.role]}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {Object.entries(byDept).map(([deptName, users]) => (
                      <SelectGroup key={deptName}>
                        <SelectLabel className="text-[10px] text-[#AAAAAA] uppercase tracking-wider">{deptName}</SelectLabel>
                        {users.map(u => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-sm">{u.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-[#737373] leading-5">Choose the department or role that best fits your position.</p>
              </div>

              <div className="flex flex-col gap-2 w-full">
                <label className="text-sm font-medium text-[#282828]">4-Digit PIN</label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="• • • •"
                  className="h-9 rounded-lg border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-center text-lg tracking-widest"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-[#CC1F1F] text-sm bg-[#FDECEA] border border-[#F5A8A8] px-3 py-2 rounded-lg w-full">
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

            <p className="text-[#737373] text-[10px] leading-4 text-center w-full">
              Contact Corporate Planning if you have forgotten your PIN.
            </p>
          </div>
        </div>

        {/* Right: photo panel */}
        <div className="hidden lg:flex relative w-[648px] h-full max-h-[810px] rounded-[32px] overflow-hidden items-start justify-end p-8 shrink-0">
          <Image src="/login/office-photo.png" alt="" fill priority className="object-cover pointer-events-none" />
          <Image src="/login/itsec-logo-white.svg" alt="ITSEC" width={87} height={19} className="relative h-5 w-auto" />
        </div>
      </div>
    </div>
  )
}
