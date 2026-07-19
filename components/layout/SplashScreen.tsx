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
const SPRING_EASE = [0.34, 1.56, 0.64, 1] as const

// Modeled on Facebook web's splash: the product's own mark centered and large, with a small
// "from [parent brand]" line beneath it — here, the full ITSEC KPI TRACKER wordmark centered, and
// "From" + the compact ITSEC monogram below. The signature move is the red "E" accent (ITSEC's
// own iconic mark — the three horizontal strokes visible in both this monogram and the main
// wordmark) starting the intro alone and full-size, then sharing a layoutId with its small
// counterpart inside the "From ITSEC" line — framer-motion interpolates the position/size delta
// automatically (a "shared layout" transition), so the accent visually shrinks and glides into
// place rather than just cutting from one state to the other.
export function SplashScreen() {
  // Defaults to visible so the very first paint (server-rendered HTML, before any JS has run)
  // already covers the page — the alternative (defaulting to false, flipping true in an effect)
  // would flash the real page first and then slap the splash on top of it, which is the opposite
  // of what a splash screen is for. The layout effect below runs before the browser paints, so a
  // same-tab repeat visit (sessionStorage already set) gets dismissed before the user ever sees it.
  const [visible, setVisible] = useState(true)
  const [phase, setPhase] = useState<'intro' | 'reveal'>('intro')

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
    const toReveal = setTimeout(() => setPhase('reveal'), 600)
    const toHide = setTimeout(() => setVisible(false), 2200)
    return () => { clearTimeout(toReveal); clearTimeout(toHide) }
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-app overflow-hidden"
          style={{ height: '100dvh' }}
        >
          {/* Main app mark — centered, fills the available space above the "From" line */}
          <div className="flex-1 min-h-0 flex items-center justify-center w-full px-8">
            <AnimatePresence mode="wait">
              {phase === 'intro' ? (
                <motion.div
                  key="e-intro"
                  layoutId="itsec-e-morph"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.55, ease: SPRING_EASE }}
                >
                  <ItsecMonogramE className="h-16 sm:h-20 w-auto text-ink" />
                </motion.div>
              ) : (
                <motion.div
                  key="logo-reveal"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <ItsecLogo className="h-7 sm:h-9 w-auto text-ink" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* "From ITSEC" — column, centered, "From" smaller than the mark beneath it */}
          <div className="pb-10 sm:pb-14 shrink-0 flex flex-col items-center gap-2">
            <motion.span
              className="text-[11px] font-medium text-ink-faint tracking-[0.02em]"
              animate={{ opacity: phase === 'reveal' ? 1 : 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              From
            </motion.span>
            <div className="flex items-center gap-[3px] h-4">
              <motion.div animate={{ opacity: phase === 'reveal' ? 1 : 0 }} transition={{ duration: 0.35, delay: 0.1, ease: EASE }}>
                <ItsecMonogramBeforeE className="h-4 w-auto text-ink" />
              </motion.div>
              {phase === 'reveal' && (
                <motion.div layoutId="itsec-e-morph" transition={{ duration: 0.55, ease: SPRING_EASE }}>
                  <ItsecMonogramE className="h-4 w-auto text-ink" />
                </motion.div>
              )}
              <motion.div animate={{ opacity: phase === 'reveal' ? 1 : 0 }} transition={{ duration: 0.35, delay: 0.1, ease: EASE }}>
                <ItsecMonogramAfterE className="h-4 w-auto text-ink" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
