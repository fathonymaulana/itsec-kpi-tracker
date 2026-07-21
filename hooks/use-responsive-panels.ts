'use client'
import { useState, useEffect, useRef } from 'react'

// The left (date picker) and right (add-ons) panels are fixed-width (350px/400px) and lay on top
// of the main content via reserved padding — comfortable at a genuinely wide desktop window, but a
// non-maximized browser (or a laptop's native resolution) showing both at once leaves too little
// room for the middle column, visibly squeezing inputs and cards. A CSS breakpoint alone can't tell
// a maximized 1280px window from a cramped one, so this instead keeps each panel's default open
// state in sync with whether the window currently has room for it — closed automatically below its
// own threshold, reopened automatically once space is available again — but only for as long as the
// user hasn't manually touched that panel. The moment they do, their choice sticks until they close
// it themselves; this never fights a deliberate open/close with an auto one.
const RIGHT_PANEL_MIN_WIDTH = 1280 // xl — the add-ons panel goes first; it's the least essential
const LEFT_PANEL_MIN_WIDTH = 1024 // lg — the date-picker panel closes next if space is still tight
const RESIZE_DEBOUNCE_MS = 100

export function useResponsivePanels() {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const leftOverridden = useRef(false)
  const rightOverridden = useRef(false)

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
    evaluate()
    window.addEventListener('resize', onResize)
    return () => { clearTimeout(timer); window.removeEventListener('resize', onResize) }
  }, [])

  return {
    leftPanelOpen,
    rightPanelOpen,
    toggleLeftPanel: () => { leftOverridden.current = true; setLeftPanelOpen(v => !v) },
    toggleRightPanel: () => { rightOverridden.current = true; setRightPanelOpen(v => !v) },
  }
}
