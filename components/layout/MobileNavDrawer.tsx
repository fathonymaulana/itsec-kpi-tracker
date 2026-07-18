'use client'
import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  CloseCircleLineDuotone as CloseIcon,
  BellLineDuotone as BellLine,
} from '@solar-icons/react-perf'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { AddOnsPanel } from '@/components/layout/AddOnsPanel'
import { useAuth } from '@/lib/auth'
import { cn, iconHoverClass } from '@/lib/utils'

export interface MobileNavItem {
  href: string
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>
  active: boolean
}

interface MobileNavDrawerProps {
  open: boolean
  onClose: () => void
  navItems: MobileNavItem[]
  onNavigate: (href: string) => void
}

// Consolidates DeptTopNav's nav links + the AddOnsPanel ("nav extra") behind a single mobile CTA —
// on small screens neither the center nav nor the right AnimatedAside panel (which normally hosts
// AddOnsPanel) are shown at all, so without this drawer dark mode/sign out would be unreachable.
export function MobileNavDrawer({ open, onClose, navItems, onNavigate }: MobileNavDrawerProps) {
  const { user } = useAuth()
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Mirrors `open`, but lags behind it on close — GSAP needs the elements to still be in the DOM to
  // tween them out, so this stays true until the exit tween's onComplete fires, only then unmounting.
  const [rendered, setRendered] = useState(open)

  useEffect(() => {
    if (open) setRendered(true)
  }, [open])

  useGSAP(() => {
    if (!rendered || !backdropRef.current || !panelRef.current) return
    if (open) {
      gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out' })
      gsap.fromTo(panelRef.current, { x: '100%' }, { x: '0%', duration: 0.42, ease: 'expo.out' })
    } else {
      gsap.to(backdropRef.current, { opacity: 0, duration: 0.28, ease: 'power1.in' })
      gsap.to(panelRef.current, {
        x: '100%',
        duration: 0.32,
        ease: 'power3.in',
        onComplete: () => setRendered(false),
      })
    }
  }, [open, rendered])

  if (!rendered) return null

  return (
    <>
      <div ref={backdropRef} className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div ref={panelRef} className="fixed inset-y-0 right-0 w-[85vw] max-w-[360px] bg-panel z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <span className="text-base font-semibold text-ink tracking-[-0.192px]">Menu</span>
          <button
            onClick={onClose}
            className={cn('size-9 rounded-full bg-panel-soft flex items-center justify-center', iconHoverClass)}
            title="Close menu"
          >
            <CloseIcon size={18} className="text-ink" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-8">
          {user && (
            <button
              onClick={() => { onNavigate('/profile'); onClose() }}
              className="mx-6 flex items-center gap-3 bg-panel-soft border border-divider rounded-2xl px-4 py-3.5 hover:border-[#CC1F1F] transition-colors"
            >
              <Avatar className="ring-1 ring-divider">
                {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} />}
                <AvatarFallback className="text-[10px]">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 text-left">
                <div className="text-sm font-medium text-ink truncate">{user.name}</div>
                <div className="text-xs text-ink-muted truncate">View profile</div>
              </div>
            </button>
          )}

          <div className="flex flex-col gap-1.5 px-6">
            {navItems.map(item => (
              <button
                key={item.href}
                onClick={() => { onNavigate(item.href); onClose() }}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3.5 transition-colors',
                  item.active ? 'bg-panel-soft text-ink font-medium' : 'text-ink-soft hover:bg-panel-soft'
                )}
              >
                <item.Icon size={20} />
                <span className="text-sm">{item.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 mx-6 bg-panel-soft border border-divider rounded-2xl px-4 py-3.5">
            <BellLine size={18} className="text-ink-faint shrink-0" />
            <span className="text-sm text-ink-muted">You&apos;re all caught up — no notifications.</span>
          </div>

          <div className="border-t border-divider pt-2">
            <AddOnsPanel />
          </div>
        </div>
      </div>
    </>
  )
}
