'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// GSAP's power2.inOut (ease-in-out: slow start, fast middle, slow settle) is the reference curve
// asked for — cubic-bezier(0.65,0,0.35,1) is the closest standard CSS equivalent.
const DIGIT_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1]

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

const STEP_DURATION_S = 0.12

// One digit position counting up from 0 to `target`, one integer at a time (0,1,2,...,target) — not
// a single reveal of the final value. `startDelay` is when THIS digit position begins; it only
// starts ticking after that, so a parent can chain positions left-to-right (see CountUpNumber below).
function CountingDigit({ target, startDelay }: { target: number; startDelay: number }) {
  const [step, setStep] = useState(0)
  const [started, setStarted] = useState(startDelay === 0)

  useEffect(() => {
    if (startDelay === 0) return
    const t = setTimeout(() => setStarted(true), startDelay * 1000)
    return () => clearTimeout(t)
  }, [startDelay])

  useEffect(() => {
    if (!started || step >= target) return
    const t = setTimeout(() => setStep(s => s + 1), STEP_DURATION_S * 1000)
    return () => clearTimeout(t)
  }, [started, step, target])

  return <AnimatedDigit value={String(step)} duration={STEP_DURATION_S} revealOnMount />
}

// Dashboard stat-card numbers: ticks each digit position up from 0 to its target value one integer
// at a time (41 plays 0,1,2,3,4 on the tens digit, THEN 0,1 on the ones digit — not a single reveal
// of "41"), with every CountUpNumber on the page starting together (no cross-card/cross-number delay,
// only the within-number left-to-right digit sequencing).
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
  const chars = (formatter ? formatter(value) : String(value)).split('')
  let cumulativeDelay = 0
  return (
    <span className={cn('inline-flex items-baseline tabular-nums font-sans', className)} style={style}>
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} className="leading-none">{ch}</span>
        const target = parseInt(ch, 10)
        const startDelay = cumulativeDelay
        cumulativeDelay += target * STEP_DURATION_S
        return <CountingDigit key={i} target={target} startDelay={startDelay} />
      })}
    </span>
  )
}
