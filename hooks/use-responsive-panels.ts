'use client'
import { useState, useEffect, useLayoutEffect, useRef } from 'react'

// The left (date picker) and right (add-ons) panels are fixed-width (350px/400px) and lay on top
// of the main content via reserved padding — comfortable at a genuinely wide desktop window, but a
// non-maximized browser (or a laptop's native resolution) showing both at once leaves too little
// room for the middle column, visibly squeezing inputs and cards. A CSS breakpoint alone can't tell
// a maximized 1280px window from a cramped one, so this instead keeps each panel's default open
// state in sync with whether the window currently has room for it — closed automatically below its
// own threshold, reopened automatically once space is available again — but only for as long as the
// user hasn't manually touched that panel. The moment they do, their choice is remembered (below)
// and sticks — across page navigation and across reloads, on every page that uses this hook, not
// just the one they toggled it on — until they close it themselves again.
const RIGHT_PANEL_MIN_WIDTH = 1280 // xl — the add-ons panel goes first; it's the least essential
const LEFT_PANEL_MIN_WIDTH = 1024 // lg — the date-picker panel closes next if space is still tight
const RESIZE_DEBOUNCE_MS = 100

// Same plain-localStorage convention AddOnsPanel's dark-mode toggle already uses for a UI
// preference — unscoped per-browser, not per-user, matching how every other display preference in
// this app persists.
const LEFT_KEY = 'itsec_kpi_left_panel_open'
const RIGHT_KEY = 'itsec_kpi_right_panel_open'

// useLayoutEffect is a no-op (with a dev warning) during Next's server render — this guards it so
// the correction below only ever runs the browser-only branch, never the SSR one.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

function readStored(key: string): boolean | null {
  try {
    const v = localStorage.getItem(key)
    if (v === '1') return true
    if (v === '0') return false
  } catch { /* storage unavailable — fall through as if never set */ }
  return null
}

function writeStored(key: string, value: boolean) {
  try { localStorage.setItem(key, value ? '1' : '0') } catch { /* storage unavailable — won't persist */ }
}

export function useResponsivePanels() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const leftOverridden = useRef(false)
  const rightOverridden = useRef(false)

  // Runs synchronously before the browser paints the new page — a plain useEffect here would let
  // the very first frame paint with both panels at their default-open state, and only correct them
  // a tick later. With framer-motion's AnimatePresence driving each panel's mount/exit animation off
  // that same open/closed flag, that one-tick delay was enough to visibly start the "opening"
  // animation before immediately reversing into "closing" — which reads as "my collapsed preference
  // didn't stick" even though the state was technically correct a moment later. Correcting before
  // paint means a panel the user previously closed never gets drawn open at all, on any page.
  useIsomorphicLayoutEffect(() => {
    const storedLeft = readStored(LEFT_KEY)
    const storedRight = readStored(RIGHT_KEY)
    if (storedLeft !== null) { leftOverridden.current = true; setLeftPanelOpen(storedLeft) }
    if (storedRight !== null) { rightOverridden.current = true; setRightPanelOpen(storedRight) }

    const w = window.innerWidth
    if (!rightOverridden.current) setRightPanelOpen(w >= RIGHT_PANEL_MIN_WIDTH)
    if (!leftOverridden.current) setLeftPanelOpen(w >= LEFT_PANEL_MIN_WIDTH)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const evaluate = () => {
      const w = window.innerWidth
      if (!rightOverridden.current) setRightPanelOpen(w >= RIGHT_PANEL_MIN_WIDTH)
      if (!leftOverridden.current) setLeftPanelOpen(w >= LEFT_PANEL_MIN_WIDTH)
    }
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(evaluate, RESIZE_DEBOUNCE_MS)
    }
    window.addEventListener('resize', onResize)
    return () => { clearTimeout(timer); window.removeEventListener('resize', onResize) }
  }, [])

  return {
    leftPanelOpen,
    rightPanelOpen,
    toggleLeftPanel: () => {
      leftOverridden.current = true
      setLeftPanelOpen(v => { const next = !v; writeStored(LEFT_KEY, next); return next })
    },
    toggleRightPanel: () => {
      rightOverridden.current = true
      setRightPanelOpen(v => { const next = !v; writeStored(RIGHT_KEY, next); return next })
    },
  }
}
