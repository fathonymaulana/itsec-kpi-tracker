'use client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { LogOut } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

interface AppNavProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export function AppNav({ title, subtitle, actions }: AppNavProps) {
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <header className="bg-[#CC1F1F] px-6 md:px-8 py-4 flex items-center gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 bg-white rounded-sm flex items-center justify-center">
          <span className="text-[#CC1F1F] font-semibold text-xs">IT</span>
        </div>
        <div className="hidden sm:block">
          <div className="text-white font-semibold text-sm leading-none">ITSEC</div>
          <div className="text-white/60 text-[10px] font-normal">KPI Tracker</div>
        </div>
      </div>

      {(title || subtitle) && (
        <div className="flex-1 min-w-0 ml-2 hidden md:block">
          <div className="h-4 w-px bg-white/20 inline-block mr-4 align-middle" />
          {title && <span className="text-white font-medium text-sm">{title}</span>}
          {subtitle && <span className="text-white/60 text-xs ml-2 font-normal">{subtitle}</span>}
        </div>
      )}

      <div className="flex-1" />

      {actions && <div className="flex items-center gap-2">{actions}</div>}

      {user && (
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:block text-right">
            <div className="text-white text-xs font-medium leading-none">{user.name}</div>
            <div className="text-white/60 text-[10px] font-normal mt-0.5 capitalize">{user.role.replace('_', ' ')}</div>
          </div>
          <button onClick={() => router.push('/profile')} title="Profile">
            <Avatar size="sm" className="ring-2 ring-white/20 hover:ring-white/40 transition-all">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
              <AvatarFallback className="bg-white/10 text-white text-[10px]">
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-normal px-2.5 py-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      )}
    </header>
  )
}
