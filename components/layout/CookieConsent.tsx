'use client'
import { useState, useEffect } from 'react'
import { Cookie } from 'lucide-react' // no Solar Icons equivalent for a cookie glyph — kept as the one intentional exception
import { AltArrowDownLineDuotone as ChevronDown, CloseCircleLineDuotone as X } from '@solar-icons/react-perf'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { getCookie, setCookie } from '@/lib/cookies'
import { cn, iconHoverClass } from '@/lib/utils'

const CONSENT_COOKIE = 'itsec_kpi_cookie_consent'

const STORAGE_ITEMS = [
  {
    label: 'Session',
    detail: 'Keeps you signed in as you move between pages, so you’re not re-entering your PIN every click.',
  },
  {
    label: 'Interface preferences',
    detail: 'Remembers small display choices — like whether the sidebar is expanded — so the app looks the way you left it.',
  },
  {
    label: 'Account switcher',
    detail: 'Recalls which accounts have signed in on this device, so Switch Account has someone to show you.',
  },
]

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!getCookie(CONSENT_COOKIE)) {
      setVisible(true)
      requestAnimationFrame(() => setEntered(true))
    }
  }, [])

  const dismiss = () => {
    setCookie(CONSENT_COOKIE, 'acknowledged', 365)
    setEntered(false)
    setTimeout(() => setVisible(false), 200)
  }

  if (!visible) return null

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 transition-all duration-300 ease-out',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      )}
    >
      <div className="w-full max-w-2xl bg-panel border border-divider shadow-2xl rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-danger-soft flex items-center justify-center shrink-0">
            <Cookie size={16} className="text-[#CC1F1F]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink">A quick word on cookies</p>
            <p className="text-sm text-ink-soft font-normal mt-1 leading-relaxed">
              KPI Tracker is an internal ITSEC tool, and it keeps its footprint just as internal: the only cookies and
              local storage we use are the ones that keep you signed in, remember your interface preferences, and
              speed up switching between your own accounts. Nothing here tracks you, profiles you, or gets shared
              with a third party.
            </p>

            <button
              onClick={() => setExpanded(v => !v)}
              className={cn('flex items-center gap-1 text-xs font-medium text-[#CC1F1F] hover:text-[#8B1A1A] mt-2', iconHoverClass)}
            >
              What exactly do we store?
              <ChevronDown size={13} className={cn('transition-transform duration-200', expanded && 'rotate-180')} />
            </button>

            {expanded && (
              <ul className="mt-3 space-y-2 border-t border-divider pt-3">
                {STORAGE_ITEMS.map(item => (
                  <li key={item.label} className="text-xs text-ink-soft font-normal">
                    <span className="font-medium text-ink">{item.label}.</span> {item.detail}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2 mt-4">
              <Button
                onClick={dismiss}
                className={cn('bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white font-medium text-xs h-8 px-4', iconHoverClass)}
              >
                Understood
              </Button>
              <span className="text-[10px] text-ink-faint font-normal">Essential only — nothing to opt out of.</span>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger
              onClick={dismiss}
              className={cn('shrink-0 text-ink-faint hover:text-ink-soft p-1', iconHoverClass)}
            >
              <X size={14} />
            </TooltipTrigger>
            <TooltipContent>Dismiss</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
