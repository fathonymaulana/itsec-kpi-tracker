'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const DIGIT_EASE: [number, number, number, number] = [0.62, 0.05, 0.01, 0.99]

// One digit's own independent "odometer" slot — the old digit slides up and fades out while the
// new one slides up from below to replace it, each digit position transitioning independently
// (exactly like a mechanical odometer/departure-board flip, not the whole number crossfading at once).
// leading-none on every layer is what makes the height:1em wrapper an exact fit — the browser's
// default line-height (~1.2-1.5x font-size) would otherwise render a taller line box than this
// wrapper allows, and overflow-hidden was clipping the difference off the numerals.
// `revealOnMount` controls AnimatePresence's own `initial` prop: false (the live-clock case) means a
// digit that's already correct when the component first mounts doesn't play an entrance — it only
// animates when its value actually changes afterward. true means it always plays its entrance,
// including on that very first mount (used internally by the count-up digit below).
function AnimatedDigit({ value, duration = 0.55, revealOnMount = false }: { value: string; duration?: number; revealOnMount?: boolean }) {
  return (
    <span className="relative inline-block overflow-hidden leading-none" style={{ height: '1em' }}>
      <span className="invisible leading-none">{value}</span>
      <AnimatePresence mode="popLayout" initial={revealOnMount}>
        <motion.span
          key={value}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration, ease: DIGIT_EASE }}
          className="absolute inset-0 leading-none"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// Drop-in replacement for rendering a number/time string with per-digit roll animation. Only digit
// characters (0-9) animate — punctuation (":", ".", "%") stays static since it never "changes value"
// the same way. Matches digits by their position in the string, so a digit COUNT change (9 → 10)
// isn't a smooth transition at that position — an inherent, accepted limitation of this technique.
// items-baseline + leading-none on the static characters keeps them level with the digit slots next
// to them (e.g. the "%" in "75%") instead of drifting off their shared text baseline.
// font-sans is explicit (not just inherited from <body>) so this never silently picks up a different
// family from whatever ancestor happens to wrap it.
export function AnimatedNumber({
  value,
  className,
  style,
}: {
  value: string | number
  className?: string
  style?: CSSProperties
}) {
  const chars = String(value).split('')
  return (
    <span className={cn('inline-flex items-baseline tabular-nums font-sans', className)} style={style}>
      {chars.map((ch, i) => (/\d/.test(ch) ? <AnimatedDigit key={i} value={ch} /> : <span key={i} className="leading-none">{ch}</span>))}
    </span>
  )
}

const STEP_MS = 35

// Dashboard stat-card numbers: one single count from 0 up to `value`, one integer at a time
// (0,1,2,...,value) — not a separate animation phase per digit position. Each digit position just
// renders whatever character that integer happens to have, so the ones place naturally ticks on
// every step while the tens place only changes at each ten's boundary — exactly how a real
// mechanical counter behaves, with no separate delay/sequencing logic needed to make that happen.
export function CountUpNumber({
  value,
  formatter,
  className,
  style,
}: {
  value: number
  formatter?: (n: number) => string
  className?: string
  style?: CSSProperties
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value <= 0) { setDisplay(value); return }
    let step = 0
    const id = setInterval(() => {
      step += 1
      setDisplay(step)
      if (step >= value) clearInterval(id)
    }, STEP_MS)
    return () => clearInterval(id)
  }, [value])

  const chars = (formatter ? formatter(display) : String(display)).split('')
  return (
    <span className={cn('inline-flex items-baseline tabular-nums font-sans', className)} style={style}>
      {chars.map((ch, i) => (/\d/.test(ch) ? <AnimatedDigit key={i} value={ch} duration={0.18} revealOnMount /> : <span key={i} className="leading-none">{ch}</span>))}
    </span>
  )
}
