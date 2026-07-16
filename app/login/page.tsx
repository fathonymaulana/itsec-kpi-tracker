'use client'
import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'

interface DirectoryUser {
  id: number
  name: string
  role: 'dept_head' | 'corp_planning' | 'board' | 'super_admin'
  dept_id: string | null
  dept_name: string | null
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  corp_planning: 'Corporate Planning',
  board: 'Board',
}

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [directory, setDirectory] = useState<DirectoryUser[]>([])
  const [selected, setSelected] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/users/directory')
      .then(r => r.json())
      .then(data => setDirectory(data.users || []))
      .catch(() => setError('Failed to load users. Please refresh.'))
  }, [])

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
      else if (role === 'super_admin') router.push('/super-admin')
      else router.push('/board')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9F9]">
      {/* Red header banner */}
      <div className="bg-[#CC1F1F] px-8 py-5 flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-sm flex items-center justify-center">
          <span className="text-[#CC1F1F] font-semibold text-sm">IT</span>
        </div>
        <div>
          <div className="text-white font-semibold text-lg leading-none">ITSEC</div>
          <div className="text-white/70 text-xs font-normal mt-0.5">Asia Tbk</div>
        </div>
      </div>

      {/* Login card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white border border-[#EBEBEB] shadow-sm w-full max-w-sm p-8">
          <h1 className="font-semibold text-[#1A1A1A] text-xl mb-1">KPI Tracker</h1>
          <p className="text-[#808080] text-sm font-normal mb-8">Sign in with your name and PIN</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#595959] mb-1.5">Your Name</label>
              <Select value={selected} onValueChange={v => setSelected(v ?? '')}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select your name" />
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
            </div>

            <div>
              <label className="block text-xs font-medium text-[#595959] mb-1.5">4-Digit PIN</label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="• • • •"
                className="text-center text-lg tracking-widest"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[#CC1F1F] text-sm bg-[#FDECEA] border border-[#F5A8A8] px-3 py-2 rounded">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={!selected || pin.length !== 4 || loading}
              className="w-full bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white font-medium mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-[#AAAAAA] text-xs text-center mt-8 font-normal">
            Contact Corporate Planning if you have forgotten your PIN.
          </p>
        </div>
      </div>
    </div>
  )
}
