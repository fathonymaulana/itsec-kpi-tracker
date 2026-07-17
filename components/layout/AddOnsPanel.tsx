'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { SwitchAccountDialog } from '@/components/layout/SwitchAccountDialog'
import { Switch } from '@/components/ui/switch'

const DARK_MODE_KEY = 'itsec_kpi_dark_mode'

export function AddOnsPanel() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [darkMode, setDarkMode] = useState(false)

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
      <div className="pb-6 pl-6 pr-12 pt-12 w-full">
        <div className="pt-3">
          <div className="pb-3">
            <div className="text-base font-semibold text-[#282828] tracking-[-0.192px]">ADD-ONS</div>
            <p className="text-sm text-[#737373] mt-1.5">Customize your experience with optional add-ons.</p>
          </div>
          <div className="py-1.5">
            <div className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-[10px] px-4 py-3.5 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[#282828]">Dark mode</div>
                <div className="text-xs text-[#737373] mt-0.5">Switch display theme</div>
              </div>
              <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 pb-6 pl-6 pr-12 pt-4 w-full">
        <div className="text-xs text-[#737373] uppercase tracking-wide">Others</div>

        <SwitchAccountDialog
          renderTrigger={(onClick) => (
            <button
              onClick={onClick}
              className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-xl px-4 py-3.5 w-full flex items-center justify-between hover:border-[#CC1F1F] transition-colors group"
            >
              <span className="text-base text-[#282828] tracking-[-0.192px]">Switch account</span>
              <ArrowLeftRight size={20} className="text-[#282828] group-hover:scale-110 transition-transform" />
            </button>
          )}
        />

        <button
          onClick={handleLogout}
          className="bg-[#f5f5f5] border border-[#e5e5e5] rounded-xl px-4 py-3.5 w-full flex items-center justify-between hover:border-[#CC1F1F] transition-colors group"
        >
          <span className="text-base text-[#dc2626] tracking-[-0.192px]">Log out</span>
          <LogOut size={20} className="text-[#dc2626] group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </div>
  )
}
