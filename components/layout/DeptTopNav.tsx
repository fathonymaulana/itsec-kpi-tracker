'use client'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { Home2Linear as Home, ClipboardListLinear as ClipboardList } from '@solar-icons/react-perf'
import { useAuth } from '@/lib/auth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/dept/dashboard', label: 'Dashboard', Icon: Home },
  { href: '/dept', label: 'Data Entry', Icon: ClipboardList },
]

export function DeptTopNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  return (
    <header className="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] flex items-center justify-between px-6 h-16 shrink-0">
      <div className="flex items-center gap-3.5">
        <Image src="/login/itsec-logo-badge.svg" alt="ITSEC KPI Tracker" width={179} height={19} className="h-5 w-auto" />
      </div>

      <nav className="flex items-center h-full">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                'flex flex-col items-center justify-center h-full w-32 border-b-[3px] transition-colors',
                active ? 'border-[#282828] text-[#282828]' : 'border-transparent text-[#AAAAAA] hover:text-[#595959]'
              )}
              title={item.label}
            >
              <item.Icon size={22} />
            </button>
          )
        })}
      </nav>

      <div className="flex items-center gap-3">
        {user && (
          <button onClick={() => router.push('/profile')} title="Profile">
            <Avatar size="sm" className="ring-1 ring-[#e5e5e5]">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
              <AvatarFallback className="text-[10px]">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </button>
        )}
      </div>
    </header>
  )
}
