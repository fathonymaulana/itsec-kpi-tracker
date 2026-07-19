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
  CheckCircleLineDuotone as ApprovedIcon,
  CloseCircleLineDuotone as RejectedIcon,
  ShieldCheckLineDuotone as VerifiedIcon,
  DangerTriangleLineDuotone as FlaggedIcon,
} from '@solar-icons/react-perf'
import { useAuth, authHeaders } from '@/lib/auth'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { MONTHS, getDefaultMonth, getDefaultYear } from '@/lib/status'
import { cn, iconHoverClass } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { playNotificationSound } from '@/lib/notification-sound'
import { ItsecLogo } from '@/components/layout/ItsecLogo'
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer'

type NotifKind = 'modify_pending' | 'modify_approved' | 'modify_rejected' | 'verified' | 'flagged'

interface NotifItem {
  id: string
  kind: NotifKind
  title: string
  description: string
  timestamp: string
  href: string
}

const NOTIF_ICONS: Record<NotifKind, typeof ModifyIcon> = {
  modify_pending: ModifyIcon,
  modify_approved: ApprovedIcon,
  modify_rejected: RejectedIcon,
  verified: VerifiedIcon,
  flagged: FlaggedIcon,
}

// corp_planning's badge is a real task-queue count (pending modify requests never disappear on
// their own — only resolving them removes the badge). dept_head's is a plain "something happened"
// dot instead: those events (approved/rejected/verified/flagged) are one-time FYIs, not open work,
// so it clears the moment the bell is opened rather than needing to be individually resolved.
const POLL_INTERVAL_MS = 20000
const seenKey = (userId: number) => `itsec_kpi_seen_notifications_${userId}`

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
  const [notifItems, setNotifItems] = useState<NotifItem[]>([])
  const [hasUnseen, setHasUnseen] = useState(false)
  const isTaskQueue = user?.role === 'corp_planning'

  const goTo = useCallback((href: string) => {
    setNotifOpen(false)
    setDrawerOpen(false)
    router.push(href)
  }, [router])

  // Real notifications, polled (no realtime/websocket infra in this app), instead of decorative —
  // a CorCom modify request landing in Data Verification and CorPlan actually being told about it
  // were two disconnected things before this, and dept_head never heard back about their own
  // requests or KPI verifications at all.
  //
  // corp_planning gets pending modify requests from every department: a real, always-current task
  // queue (badge = how many still need review, same count admin/page.tsx's tab already shows).
  // dept_head gets their own department's recently-reviewed modify requests and recently-verified/
  // flagged KPIs: one-time FYIs rather than open work, so that list only shows what's still unseen
  // and clears the moment the bell is opened, instead of accumulating forever.
  useEffect(() => {
    if (!token || !user) return
    let cancelled = false

    const poll = async () => {
      try {
        let items: NotifItem[] = []

        if (user.role === 'corp_planning') {
          const r = await fetch('/api/modify-requests?status=pending', { headers: authHeaders(token) })
          const data = await r.json()
          items = (data.requests || []).map((req: { id: number; dept_name: string | null; requested_by_name: string | null; kpi_name: string | null; month: number; year: number; requested_at: string }) => ({
            id: `modify_pending-${req.id}`,
            kind: 'modify_pending' as const,
            title: `New modify request from ${req.dept_name ?? 'a department'}`,
            description: `${req.requested_by_name ?? 'Someone'} wants to edit "${req.kpi_name ?? 'a KPI'}" for ${MONTHS[req.month - 1]} ${req.year}. Review it to approve or reject.`,
            timestamp: req.requested_at,
            href: '/admin?tab=modify',
          }))
        } else if (user.role === 'dept_head' && user.dept_id) {
          const [modifyRes, verRes] = await Promise.all([
            fetch(`/api/modify-requests?dept_id=${user.dept_id}`, { headers: authHeaders(token) }),
            fetch(`/api/verifications?dept_id=${user.dept_id}&year=${getDefaultYear()}&month=${getDefaultMonth()}`, { headers: authHeaders(token) }),
          ])
          const modifyData = await modifyRes.json()
          const verData = await verRes.json()

          type ModifyRow = { id: number; status: string; reviewed_at: string | null; review_note: string | null; kpi_name: string | null; month: number; year: number }
          const reviewed: NotifItem[] = (modifyData.requests || [])
            // 'resolved' (an approved request the dept_head already acted on and re-submitted) isn't
            // new news — only the first approved/rejected transition is.
            .filter((req: ModifyRow) => (req.status === 'approved' || req.status === 'rejected') && req.reviewed_at)
            .map((req: ModifyRow) => req.status === 'approved' ? {
              id: `modify_approved-${req.id}`,
              kind: 'modify_approved' as const,
              title: `Your request to edit "${req.kpi_name ?? 'a KPI'}" was approved`,
              description: `This matrix is unlocked for editing for ${MONTHS[req.month - 1]} ${req.year} — head to Data Entry to make your change. Everything else stays submitted.`,
              timestamp: req.reviewed_at as string,
              href: '/dept',
            } : {
              id: `modify_rejected-${req.id}`,
              kind: 'modify_rejected' as const,
              title: `Your request to edit "${req.kpi_name ?? 'a KPI'}" was rejected`,
              description: req.review_note
                ? `${MONTHS[req.month - 1]} ${req.year} stays locked: "${req.review_note}"`
                : `${MONTHS[req.month - 1]} ${req.year} stays locked as submitted.`,
              timestamp: req.reviewed_at as string,
              href: '/dept',
            })

          type VerifRow = { id: number; status: string; note: string | null; kpi_name: string | null; verified_at: string }
          const verifications: NotifItem[] = (verData.verifications || []).map((v: VerifRow) => v.status === 'verified' ? {
            id: `verified-${v.id}`,
            kind: 'verified' as const,
            title: `"${v.kpi_name ?? 'A KPI'}" was verified`,
            description: 'Corporate Planning confirmed your figures are accurate for this period.',
            timestamp: v.verified_at,
            href: '/dept',
          } : {
            id: `flagged-${v.id}`,
            kind: 'flagged' as const,
            title: `"${v.kpi_name ?? 'A KPI'}" was flagged`,
            description: v.note
              ? `Corporate Planning flagged this for correction: "${v.note}"`
              : 'Corporate Planning flagged this for correction — take another look in Data Entry.',
            timestamp: v.verified_at,
            href: '/dept',
          })

          items = [...reviewed, ...verifications]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 10)
        }

        if (cancelled) return

        // localStorage, not component state — a brand-new browser/session should see the existing
        // backlog silently (that's not "new"), but anything that arrives while the tab's open or
        // between visits should still toast exactly once. `raw === null` is "never polled on this
        // device before"; anything else diffs normally against what was last seen.
        const key = seenKey(user.user_id)
        const raw = localStorage.getItem(key)
        const isFirstEver = raw === null
        const seenIds = new Set<string>(raw ? JSON.parse(raw) : [])
        const newOnes = items.filter(it => !seenIds.has(it.id))

        if (!isFirstEver && newOnes.length > 0) {
          playNotificationSound()
          for (const it of newOnes) {
            const toastFn = it.kind === 'modify_rejected' || it.kind === 'flagged' ? toast.warning
              : it.kind === 'modify_approved' || it.kind === 'verified' ? toast.success
              : toast.info
            toastFn(it.title, {
              description: it.description,
              action: {
                label: it.kind === 'modify_rejected' || it.kind === 'flagged' ? 'Fix it now' : it.kind === 'modify_pending' ? 'Review now' : 'View',
                onClick: () => goTo(it.href),
              },
            })
          }
        }

        // Task-queue items stay visible until actually resolved; FYI items only show while unseen,
        // and merely opening the bell (see below) commits them to the seen-set.
        setNotifItems(isTaskQueue ? items : items.filter(it => !seenIds.has(it.id)))
        setHasUnseen(newOnes.length > 0)
        if (isTaskQueue) localStorage.setItem(key, JSON.stringify(items.map(it => it.id)))
      } catch { /* non-fatal — next poll retries */ }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [token, user, goTo, isTaskQueue])

  // Opening the bell is what "reads" FYI-style notifications for dept_head — commits everything
  // currently shown to the seen-set so they drop off on the next poll, instead of a task-queue item
  // that only clears once actually resolved (approve/reject/verify/flag).
  useEffect(() => {
    if (!notifOpen || isTaskQueue || !user || notifItems.length === 0) return
    const key = seenKey(user.user_id)
    const seenIds = new Set<string>(JSON.parse(localStorage.getItem(key) || '[]'))
    notifItems.forEach(it => seenIds.add(it.id))
    localStorage.setItem(key, JSON.stringify(Array.from(seenIds)))
    setHasUnseen(false)
  }, [notifOpen, isTaskQueue, user, notifItems])

  return (
    <header className="bg-panel shadow-[0_1px_3px_rgba(0,0,0,0.1)] grid grid-cols-3 items-center px-6 h-16 shrink-0">
      <div className="flex items-center gap-3.5 justify-self-start">
        <Tooltip>
          <TooltipTrigger
            onClick={() => router.push(navItems[0]?.href ?? '/login')}
            className={cn('flex items-center', iconHoverClass)}
          >
            <ItsecLogo className="h-4 w-auto text-ink" />
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
              {/* The button IS the full tab slot (h-full w-32) — hover/cursor/tooltip and the muted
                  highlight all need to cover that whole area, not just a small icon-sized inner
                  element, so nothing about the hover state depends on where exactly the pointer lands
                  inside the tab. Active tabs never get the muted hover — their hover state stays
                  exactly as the resting state, only the underline marks "current". */}
              <TooltipTrigger
                onClick={() => router.push(item.href)}
                className={cn(
                  'relative flex flex-col items-center justify-center h-full w-32 rounded-2xl transition-colors cursor-pointer',
                  active ? 'text-ink' : 'text-ink-faint hover:text-ink-soft hover:bg-muted',
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
              className={cn('size-9 rounded-lg flex items-center justify-center transition-colors hover:bg-panel-soft', iconHoverClass)}
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
              className={cn('size-9 rounded-lg flex items-center justify-center transition-colors hover:bg-panel-soft', iconHoverClass)}
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
            className={cn('relative size-9 rounded-lg flex items-center justify-center transition-colors hover:bg-panel-soft', iconHoverClass)}
            title="Notifications"
          >
            {notifOpen ? <BellBold size={18} className="text-ink" /> : <BellLine size={18} className="text-ink" />}
            {(isTaskQueue ? notifItems.length > 0 : hasUnseen) && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive ring-2 ring-panel" />
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
              <div className="text-sm font-semibold text-ink">Notifications</div>
              {isTaskQueue && notifItems.length > 0 && (
                <Badge className="size-5 rounded-full p-0 justify-center bg-muted text-muted-foreground text-[10px]">
                  {notifItems.length}
                </Badge>
              )}
            </div>
            {notifItems.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center gap-2">
                <BellLine size={28} className="text-ink-faint" />
                <p className="text-sm text-ink-muted">You&apos;re all caught up — no notifications yet.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-divider">
                {notifItems.map(n => {
                  const Icon = NOTIF_ICONS[n.kind]
                  const iconColor = n.kind === 'modify_rejected' || n.kind === 'flagged' ? 'text-danger' : n.kind === 'modify_approved' || n.kind === 'verified' ? 'text-success' : 'text-ink-faint'
                  return (
                    <button
                      key={n.id}
                      onClick={() => goTo(n.href)}
                      className="w-full text-left px-4 py-3 hover:bg-panel-soft transition-colors flex gap-2.5"
                    >
                      <Icon size={16} className={cn('shrink-0 mt-0.5', iconColor)} />
                      <div className="min-w-0">
                        <div className="text-sm text-ink font-medium">{n.title}</div>
                        <div className="text-xs text-ink-muted mt-0.5 line-clamp-2">{n.description}</div>
                        <div className="text-[10px] text-ink-faint mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                      </div>
                    </button>
                  )
                })}
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
          className={cn(buttonVariants({ variant: 'outline', size: 'icon-lg' }), 'flex md:hidden col-start-3 justify-self-end', iconHoverClass)}
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
