'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  Home2LineDuotone as HomeLine, Home2Bold as HomeBold,
  ClipboardListLineDuotone as ClipboardListLine, ClipboardListBold as ClipboardListBold,
  ClipboardCheckLineDuotone as ClipboardCheckLine, ClipboardCheckBold as ClipboardCheckBold,
  UsersGroupRoundedLineDuotone as UsersLine, UsersGroupRoundedBold as UsersBold,
  SidebarMinimalisticLineDuotone as SidebarLine, SidebarMinimalisticBold as SidebarBold,
  BellLineDuotone as BellLine, BellBold as BellBold,
} from '@solar-icons/react-perf'
import { useAuth } from '@/lib/auth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn, iconHoverClass } from '@/lib/utils'

type IconPair = { line: typeof HomeLine; bold: typeof HomeBold }

const NAV_ITEMS_BY_ROLE: Record<string, { href: string; label: string; icons: IconPair }[]> = {
  dept_head: [
    { href: '/dept/dashboard', label: 'Dashboard', icons: { line: HomeLine, bold: HomeBold } },
    { href: '/dept', label: 'Data Entry', icons: { line: ClipboardListLine, bold: ClipboardListBold } },
  ],
  corp_planning: [
    { href: '/board', label: 'Dashboard', icons: { line: HomeLine, bold: HomeBold } },
    { href: '/admin', label: 'Data Review', icons: { line: ClipboardCheckLine, bold: ClipboardCheckBold } },
    { href: '/super-admin', label: 'Users', icons: { line: UsersLine, bold: UsersBold } },
  ],
}

interface DeptTopNavProps {
  leftPanelOpen?: boolean
  onToggleLeftPanel?: () => void
  rightPanelOpen?: boolean
  onToggleRightPanel?: () => void
}

export function DeptTopNav({ leftPanelOpen, onToggleLeftPanel, rightPanelOpen, onToggleRightPanel }: DeptTopNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const navItems = NAV_ITEMS_BY_ROLE[user?.role ?? ''] ?? []
  const [notifOpen, setNotifOpen] = useState(false)

  return (
    <header className="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] grid grid-cols-3 items-center px-6 h-16 shrink-0">
      <div className="flex items-center gap-3.5 justify-self-start">
        <Image src="/login/itsec-logo-badge.svg" alt="ITSEC KPI Tracker" width={179} height={19} className="h-5 w-auto" />
      </div>

      <nav className="flex items-center h-full justify-self-center">
        {navItems.map(item => {
          const active = pathname === item.href
          const Icon = active ? item.icons.bold : item.icons.line
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
              <Icon size={22} />
            </button>
          )
        })}
      </nav>

      <div className="flex items-center gap-2 justify-self-end">
        {onToggleLeftPanel && (
          <button
            onClick={onToggleLeftPanel}
            className={cn('size-9 rounded-full bg-[#e5e5e5] flex items-center justify-center hover:bg-[#dddddd] transition-colors', iconHoverClass)}
            title="Toggle left panel"
          >
            {leftPanelOpen
              ? <SidebarBold size={18} className="text-[#282828] -scale-x-100" />
              : <SidebarLine size={18} className="text-[#282828] -scale-x-100" />}
          </button>
        )}
        {onToggleRightPanel && (
          <button
            onClick={onToggleRightPanel}
            className={cn('size-9 rounded-full bg-[#e5e5e5] flex items-center justify-center hover:bg-[#dddddd] transition-colors', iconHoverClass)}
            title="Toggle right panel"
          >
            {rightPanelOpen
              ? <SidebarBold size={18} className="text-[#282828]" />
              : <SidebarLine size={18} className="text-[#282828]" />}
          </button>
        )}

        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger
            className={cn('size-9 rounded-full bg-[#e5e5e5] flex items-center justify-center hover:bg-[#dddddd] transition-colors', iconHoverClass)}
            title="Notifications"
          >
            {notifOpen ? <BellBold size={18} className="text-[#282828]" /> : <BellLine size={18} className="text-[#282828]" />}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#e5e5e5]">
              <div className="text-sm font-semibold text-[#282828]">Notifications</div>
            </div>
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <BellLine size={28} className="text-[#DDDDDD]" />
              <p className="text-sm text-[#737373]">You&apos;re all caught up — no notifications yet.</p>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-6 bg-[#e5e5e5] mx-1" />

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
