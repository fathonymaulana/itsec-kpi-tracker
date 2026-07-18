'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Home2LineDuotone as HomeLine, Home2Bold as HomeBold,
  ClipboardListLineDuotone as ClipboardListLine, ClipboardListBold as ClipboardListBold,
  ClipboardCheckLineDuotone as ClipboardCheckLine, ClipboardCheckBold as ClipboardCheckBold,
  UsersGroupRoundedLineDuotone as UsersLine, UsersGroupRoundedBold as UsersBold,
  SidebarMinimalisticLineDuotone as SidebarLine, SidebarMinimalisticBold as SidebarBold,
  BellLineDuotone as BellLine, BellBold as BellBold,
  HamburgerMenuLineDuotone as HamburgerMenu,
} from '@solar-icons/react-perf'
import { useAuth } from '@/lib/auth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn, iconHoverClass } from '@/lib/utils'
import { ItsecLogo } from '@/components/layout/ItsecLogo'
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer'

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
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <header className="bg-panel shadow-[0_1px_3px_rgba(0,0,0,0.1)] grid grid-cols-3 items-center px-6 h-16 shrink-0">
      <div className="flex items-center gap-3.5 justify-self-start">
        <Tooltip>
          <TooltipTrigger
            onClick={() => router.push(navItems[0]?.href ?? '/login')}
            className={cn('flex items-center', iconHoverClass)}
          >
            <ItsecLogo className="h-5 w-auto text-ink" />
          </TooltipTrigger>
          <TooltipContent>Go to dashboard</TooltipContent>
        </Tooltip>
      </div>

      <nav className="hidden md:flex items-center h-full justify-self-center">
        {navItems.map(item => {
          const active = pathname === item.href
          const Icon = active ? item.icons.bold : item.icons.line
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger
                onClick={() => router.push(item.href)}
                className={cn(
                  'relative flex flex-col items-center justify-center h-full w-32 transition-colors',
                  active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
                  iconHoverClass
                )}
              >
                <Icon size={22} />
                {active && (
                  <motion.div
                    layoutId="dept-top-nav-underline"
                    className="absolute bottom-0 left-0 right-0 h-[3px] bg-ink"
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      <div className="hidden md:flex items-center gap-2 justify-self-end">
        {onToggleLeftPanel && (
          <Tooltip>
            <TooltipTrigger
              onClick={onToggleLeftPanel}
              className={cn('size-9 rounded-full bg-panel-soft flex items-center justify-center hover:bg-divider transition-colors', iconHoverClass)}
            >
              {leftPanelOpen
                ? <SidebarBold size={18} className="text-ink -scale-x-100" />
                : <SidebarLine size={18} className="text-ink -scale-x-100" />}
            </TooltipTrigger>
            <TooltipContent>{leftPanelOpen ? 'Hide left panel' : 'Show left panel'}</TooltipContent>
          </Tooltip>
        )}
        {onToggleRightPanel && (
          <Tooltip>
            <TooltipTrigger
              onClick={onToggleRightPanel}
              className={cn('size-9 rounded-full bg-panel-soft flex items-center justify-center hover:bg-divider transition-colors', iconHoverClass)}
            >
              {rightPanelOpen
                ? <SidebarBold size={18} className="text-ink" />
                : <SidebarLine size={18} className="text-ink" />}
            </TooltipTrigger>
            <TooltipContent>{rightPanelOpen ? 'Hide right panel' : 'Show right panel'}</TooltipContent>
          </Tooltip>
        )}

        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger
            className={cn('size-9 rounded-full bg-panel-soft flex items-center justify-center hover:bg-divider transition-colors', iconHoverClass)}
            title="Notifications"
          >
            {notifOpen ? <BellBold size={18} className="text-ink" /> : <BellLine size={18} className="text-ink" />}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-divider">
              <div className="text-sm font-semibold text-ink">Notifications</div>
            </div>
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <BellLine size={28} className="text-ink-faint" />
              <p className="text-sm text-ink-muted">You&apos;re all caught up — no notifications yet.</p>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-6 bg-divider mx-1" />

        {user && (
          <Tooltip>
            <TooltipTrigger onClick={() => router.push('/profile')}>
              <Avatar className="ring-1 ring-divider">
                {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
                <AvatarFallback className="text-[10px]">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>Profile</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Small screens: nav links + panel toggles + notifications + add-ons all collapse behind
          this single CTA — the AnimatedAside hosting AddOnsPanel is `hidden lg:block`, so without
          this drawer dark mode/sign out would be unreachable below that breakpoint. */}
      <Tooltip>
        <TooltipTrigger
          onClick={() => setDrawerOpen(true)}
          className={cn('flex md:hidden col-start-3 size-9 rounded-full bg-panel-soft items-center justify-center justify-self-end', iconHoverClass)}
        >
          <HamburgerMenu size={18} className="text-ink" />
        </TooltipTrigger>
        <TooltipContent>Menu</TooltipContent>
      </Tooltip>

      <MobileNavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={router.push}
        navItems={navItems.map(item => ({
          href: item.href,
          label: item.label,
          active: pathname === item.href,
          Icon: pathname === item.href ? item.icons.bold : item.icons.line,
        }))}
      />
    </header>
  )
}
