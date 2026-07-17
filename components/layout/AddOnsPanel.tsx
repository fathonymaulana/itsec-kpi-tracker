'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogoutLineDuotone as LogOut } from '@solar-icons/react-perf'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const DARK_MODE_KEY = 'itsec_kpi_dark_mode'

export function AddOnsPanel() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(DARK_MODE_KEY) === '1'
    setDarkMode(stored)
    document.documentElement.classList.toggle('dark', stored)
  }, [])

  const toggleDarkMode = (checked: boolean) => {
    setDarkMode(checked)
    localStorage.setItem(DARK_MODE_KEY, checked ? '1' : '0')
    document.documentElement.classList.toggle('dark', checked)
  }

  const handleLogout = () => {
    const firstName = user?.name?.split(' ')[0]
    logout()
    router.push('/login')
    toast.success('Signed out', { description: firstName ? `See you soon, ${firstName}.` : 'You’ve been signed out safely.' })
  }

  return (
    <div className="flex flex-col w-full">
      <div className="pb-6 pl-6 pr-12 pt-8 w-full">
        <div className="pt-0">
          <div className="pb-3">
            <div className="text-base font-semibold text-ink tracking-[-0.192px]">ADD-ONS</div>
            <p className="text-sm text-ink-muted mt-1.5">Customize your experience with optional add-ons.</p>
          </div>
          <div className="py-1.5">
            <div className="bg-panel-soft border border-divider rounded-[10px] px-4 py-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink">Dark mode</div>
                <div className="text-xs text-ink-muted mt-0.5">Switch display theme</div>
              </div>
              <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 pb-6 pl-6 pr-12 pt-4 w-full">
        <div className="text-xs text-ink-muted uppercase tracking-wide">Others</div>

        <button
          onClick={() => setConfirmLogout(true)}
          className="bg-panel-soft border border-divider rounded-xl px-4 py-3.5 w-full flex items-center justify-between hover:border-[#CC1F1F] transition-colors group"
        >
          <span className="text-[12.8px] text-[#dc2626] tracking-[-0.192px]">Sign Out</span>
          <LogOut size={20} className="text-[#dc2626] group-hover:scale-110 transition-transform" />
        </button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Sign out?"
        description="You'll need your PIN again to sign back in."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        onConfirm={handleLogout}
      />
    </div>
  )
}
