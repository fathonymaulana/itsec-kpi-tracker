'use client'
import { useState, useEffect, useRef } from 'react'

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

  useEffect(() => {
    const storedLeft = readStored(LEFT_KEY)
    const storedRight = readStored(RIGHT_KEY)
    if (storedLeft !== null) { leftOverridden.current = true; setLeftPanelOpen(storedLeft) }
    if (storedRight !== null) { rightOverridden.current = true; setRightPanelOpen(storedRight) }

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
    evaluate() // no-op for whichever panel(s) were just restored from storage above
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
