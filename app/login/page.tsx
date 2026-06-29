'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'

const DEPARTMENTS = [
  { id: 'CorCom',             label: 'CorCom' },
  { id: 'CorSec',             label: 'CorSec' },
  { id: 'FAT',                label: 'FAT' },
  { id: 'HR_GA',              label: 'HR & GA' },
  { id: 'Internal_Audit',     label: 'Internal Audit' },
  { id: 'Investor_Relations', label: 'Investor Relations' },
  { id: 'Partner_Manager',    label: 'Partner Manager' },
  { id: 'PMO',                label: 'PMO' },
  { id: 'RD',                 label: 'R & D' },
  { id: 'Sales',              label: 'Sales' },
  { id: 'SecOps',             label: 'SecOps' },
  { id: 'Technical_Writer',   label: 'Technical Writer' },
]

// Corp planning and board use PIN-only auth; dept_id sent as placeholder
const ROLE_ITEMS = [
  { id: 'corp_planning', label: 'Corporate Planning' },
  { id: 'board',         label: 'Board' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected || pin.length !== 4) return
    setLoading(true)
    setError('')
    try {
      await login(selected, pin)
      // Auth stores role in localStorage; read it for redirect
      const stored = JSON.parse(localStorage.getItem('itsec_kpi_user') || '{}')
      const role = stored.role
      if (role === 'dept_head') router.push('/dept')
      else if (role === 'corp_planning') router.push('/admin')
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
          <p className="text-[#808080] text-sm font-normal mb-8">Sign in with your department and PIN</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#595959] mb-1.5">Department / Role</label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select your department or role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-[#AAAAAA] uppercase tracking-wider">Management</SelectLabel>
                    {ROLE_ITEMS.map(r => (
                      <SelectItem key={r.id} value={r.id} className="text-sm">{r.label}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-[#AAAAAA] uppercase tracking-wider">Departments</SelectLabel>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d.id} value={d.id} className="text-sm">{d.label}</SelectItem>
                    ))}
                  </SelectGroup>
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
