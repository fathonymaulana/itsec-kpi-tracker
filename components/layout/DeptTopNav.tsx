'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Home2LineDuotone as HomeLine, Home2Bold as HomeBold,
  ClipboardListLineDuotone as ClipboardListLine, ClipboardListBold as ClipboardListBold,
  ClipboardCheckLineDuotone as ClipboardCheckLine, ClipboardCheckBold as ClipboardCheckBold,
  UsersGroupRoundedLineDuotone as UsersLine, UsersGroupRoundedBold as UsersBold,
  SidebarMinimalisticLineDuotone as SidebarLine, SidebarMinimalisticBold as SidebarBold,
  BellLineDuotone as BellLine, BellBold as BellBold,
  HamburgerMenuLineDuotone as HamburgerMenu,
  LockUnlockedLineDuotone as ModifyIcon,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { MONTHS } from '@/lib/status'
import { cn, iconHoverClass } from '@/lib/utils'
import { ItsecLogo } from '@/components/layout/ItsecLogo'
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer'

interface ModifyRequestNotif {
  id: number
  kpi_name: string | null
  dept_name: string | null
  requested_by_name: string | null
  requested_at: string
  year: number
  month: number
}

const POLL_INTERVAL_MS = 20000
const seenKey = (userId: number) => `itsec_kpi_seen_modify_requests_${userId}`

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

const ROLE_LABELS: Record<string, string> = {
  dept_head: 'Department Head',
  corp_planning: 'Corporate Planning',
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
  const { user, token } = useAuth()
  const navItems = NAV_ITEMS_BY_ROLE[user?.role ?? ''] ?? []
  const [notifOpen, setNotifOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modifyNotifs, setModifyNotifs] = useState<ModifyRequestNotif[]>([])

  const goToModifyRequests = useCallback(() => {
    setNotifOpen(false)
    setDrawerOpen(false)
    router.push('/admin?tab=modify')
  }, [router])

  // Corporate Planning's real notification source: pending modify requests from every department,
  // polled (no realtime/websocket infra in this app) rather than pushed. A department's request
  // showing up in Data Verification and a notification actually reaching CorPlan about it were two
  // disconnected things before this — the badge/list here is now driven by the same pending-requests
  // data admin/page.tsx already reviews, not a separate notification store.
  useEffect(() => {
    if (!token || user?.role !== 'corp_planning') return
    let cancelled = false

    const poll = async () => {
      try {
        const r = await fetch('/api/modify-requests?status=pending', { headers: authHeaders(token) })
        const data = await r.json()
        if (cancelled) return
        const requests: ModifyRequestNotif[] = data.requests || []
        setModifyNotifs(requests)

        // localStorage, not component state — a brand-new browser/session should see the existing
        // backlog silently (that's not "new"), but a request that arrives while the tab is open, or
        // between visits, should still toast exactly once. `raw === null` is the "never polled on
        // this device before" case; anything else diffs normally against what was last seen.
        const key = seenKey(user.user_id)
        const raw = localStorage.getItem(key)
        const isFirstEver = raw === null
        const seenIds = new Set<number>(raw ? JSON.parse(raw) : [])
        const newOnes = requests.filter(req => !seenIds.has(req.id))
        if (!isFirstEver) {
          for (const req of newOnes) {
            toast.info(`New modify request from ${req.dept_name ?? 'a department'}`, {
              description: `${req.requested_by_name ?? 'Someone'} wants to edit "${req.kpi_name ?? 'a KPI'}" for ${MONTHS[req.month - 1]} ${req.year}. Review it in Data Verification to approve or reject.`,
              action: { label: 'Review now', onClick: goToModifyRequests },
            })
          }
        }
        localStorage.setItem(key, JSON.stringify(requests.map(req => req.id)))
      } catch { /* non-fatal — next poll retries */ }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [token, user, goToModifyRequests])

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
                  'group/navitem relative flex flex-col items-center justify-center h-full w-32 transition-colors',
                  active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft',
                  iconHoverClass
                )}
              >
                {/* Inactive tabs get a muted rounded highlight on hover; active tabs never do — their
                    hover state stays exactly as the resting state, only the underline marks "current". */}
                <span className={cn('flex items-center justify-center size-11 rounded-2xl transition-colors', !active && 'group-hover/navitem:bg-muted')}>
                  <Icon size={22} />
                </span>
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
            className={cn('relative size-9 rounded-full bg-panel-soft flex items-center justify-center hover:bg-divider transition-colors', iconHoverClass)}
            title="Notifications"
          >
            {notifOpen ? <BellBold size={18} className="text-ink" /> : <BellLine size={18} className="text-ink" />}
            {modifyNotifs.length > 0 && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive ring-2 ring-panel" />
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">Notifications</div>
              {modifyNotifs.length > 0 && <Badge className="text-[10px]">{modifyNotifs.length}</Badge>}
            </div>
            {modifyNotifs.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center gap-2">
                <BellLine size={28} className="text-ink-faint" />
                <p className="text-sm text-ink-muted">You&apos;re all caught up — no notifications yet.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-divider">
                {modifyNotifs.map(n => (
                  <button
                    key={n.id}
                    onClick={goToModifyRequests}
                    className="w-full text-left px-4 py-3 hover:bg-panel-soft transition-colors flex gap-2.5"
                  >
                    <ModifyIcon size={16} className="text-ink-faint shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-sm text-ink font-medium">{n.dept_name ?? 'A department'} wants to edit a KPI</div>
                      <div className="text-xs text-ink-muted mt-0.5 truncate">
                        {n.requested_by_name ?? 'Someone'} — &quot;{n.kpi_name ?? 'Unknown KPI'}&quot; for {MONTHS[n.month - 1]} {n.year}
                      </div>
                      <div className="text-[10px] text-ink-faint mt-1">{new Date(n.requested_at).toLocaleString()}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>

        <div className="w-px h-6 bg-divider mx-1" />

        {user && (
          <Tooltip>
            <TooltipTrigger onClick={() => router.push('/profile')} className="flex items-center gap-2.5">
              <Avatar className="ring-1 ring-divider">
                {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
                <AvatarFallback className="text-[10px]">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[14px] text-foreground font-medium">{user.name}</span>
                <span className="text-[12px] text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</span>
              </div>
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
