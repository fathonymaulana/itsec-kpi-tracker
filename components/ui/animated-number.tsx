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

// A JS evaluator for the exact same cubic-bezier used for the digit-roll transition, so the overall
// count-up progress and each individual digit's motion feel like one coordinated curve rather than
// two different easings layered on top of each other. Same Newton-Raphson approach browsers use
// internally for CSS cubic-bezier() timing functions.
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const a = (a1: number, a2: number) => 1 - 3 * a2 + 3 * a1
  const b = (a1: number, a2: number) => 3 * a2 - 6 * a1
  const c = (a1: number) => 3 * a1
  const calc = (t: number, a1: number, a2: number) => ((a(a1, a2) * t + b(a1, a2)) * t + c(a1)) * t
  const slope = (t: number, a1: number, a2: number) => 3 * a(a1, a2) * t * t + 2 * b(a1, a2) * t + c(a1)
  return (x: number) => {
    let t = x
    for (let i = 0; i < 4; i++) {
      const s = slope(t, x1, x2)
      if (s === 0) break
      t -= (calc(t, x1, x2) - x) / s
    }
    return calc(t, y1, y2)
  }
}
const countEase = cubicBezier(...DIGIT_EASE)

// Dashboard stat-card numbers: a single count from 0 up to `value` that always finishes in a fixed
// total duration regardless of how large the target is — a fixed "1 integer per tick" pace (the
// previous approach) meant small numbers felt fine but larger ones dragged on. requestAnimationFrame
// interpolates displayed value along the same eased curve driving each digit's own roll, so early
// frames land close together and later ones can jump by more than 1 — visually identical to how a
// real mechanical counter behaves when it's given a fixed time budget to reach a big number.
const COUNT_DURATION_MS = 300

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
    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_DURATION_MS)
      setDisplay(Math.round(countEase(progress) * value))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  const chars = (formatter ? formatter(display) : String(display)).split('')
  return (
    <span className={cn('inline-flex items-baseline tabular-nums font-sans', className)} style={style}>
      {chars.map((ch, i) => (/\d/.test(ch) ? <AnimatedDigit key={i} value={ch} duration={0.12} revealOnMount /> : <span key={i} className="leading-none">{ch}</span>))}
    </span>
  )
}
