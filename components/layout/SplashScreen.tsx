'use client'
import { useEffect, useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ItsecLogo } from './ItsecLogo'
import { ItsecMonogramBeforeE, ItsecMonogramE, ItsecMonogramAfterE } from './ItsecMonogram'

// useLayoutEffect is a no-op (with a dev warning) during Next's server render — this guards it so
// the splash logic only ever runs the browser-only branch, never the SSR one.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Once per browser tab, not once forever — sessionStorage (not localStorage) so a cold app load
// in a fresh tab always gets the splash (matching a native app's cold-start splash), but clicking
// between /login, /dept, /board etc. within the same tab doesn't replay it on every navigation.
const SESSION_KEY = 'itsec-splash-shown'

const EASE = [0.16, 1, 0.3, 1] as const

// A static mark — the full ITSEC KPI TRACKER wordmark centered, "From ITSEC" beneath it — rather
// than the previous two-phase intro where the red "E" accent played a shared-layout move from a
// large standalone mark down into the small "From" line. Both blocks appear together as one simple
// fade/rise-in; the only other motion is the whole screen fading out once the timer below ends.
export function SplashScreen() {
  // Defaults to visible so the very first paint (server-rendered HTML, before any JS has run)
  // already covers the page — the alternative (defaulting to false, flipping true in an effect)
  // would flash the real page first and then slap the splash on top of it, which is the opposite
  // of what a splash screen is for. The layout effect below runs before the browser paints, so a
  // same-tab repeat visit (sessionStorage already set) gets dismissed before the user ever sees it.
  const [visible, setVisible] = useState(true)

  useIsomorphicLayoutEffect(() => {
    // sessionStorage can throw (private browsing, strict privacy settings, some mobile browser
    // configurations) — a throw here previously took down the entire app on first load, since this
    // effect runs unconditionally in the root layout before anything else renders. Treat a throw as
    // "not shown yet" so the splash still plays once; it just won't persist across reloads.
    let alreadyShown = false
    try {
      alreadyShown = !!sessionStorage.getItem(SESSION_KEY)
      if (!alreadyShown) sessionStorage.setItem(SESSION_KEY, '1')
    } catch { /* storage unavailable — fall through as if never shown */ }

    if (alreadyShown) {
      setVisible(false)
      return
    }
    const toHide = setTimeout(() => setVisible(false), 1400)
    return () => clearTimeout(toHide)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
          // No interactive elements live in here, and the whole point of the fix below is that this
          // overlay must never be able to eat a click meant for whatever's underneath — including
          // during its own fade-out, when it's still in the DOM (AnimatePresence keeps an exiting
          // element mounted until its exit animation finishes) but the sign-in form beneath it has
          // already become visible and tappable. A user clicking the instant they can see a button
          // was landing on this invisible-but-still-there overlay instead of the real button.
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-app overflow-hidden pointer-events-none"
          style={{ height: '100dvh' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="flex-1 min-h-0 flex flex-col items-center justify-center w-full px-8"
          >
            {/* Main app mark */}
            <div className="flex-1 min-h-0 flex items-center justify-center w-full">
              <ItsecLogo className="h-7 sm:h-9 w-auto text-ink" />
            </div>

            {/* "From ITSEC" — column, centered, "From" smaller than the mark beneath it */}
            <div className="pb-10 sm:pb-14 shrink-0 flex flex-col items-center gap-2">
              <span className="text-[11px] font-medium text-ink-faint tracking-[0.02em]">From</span>
              <div className="flex items-center gap-[3px] h-4">
                <ItsecMonogramBeforeE className="h-4 w-auto text-ink" />
                <ItsecMonogramE className="h-4 w-auto text-ink" />
                <ItsecMonogramAfterE className="h-4 w-auto text-ink" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
