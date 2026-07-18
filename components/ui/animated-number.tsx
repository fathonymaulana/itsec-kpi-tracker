'use client'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// One digit's own independent "odometer" slot — the old digit slides up and fades out while the
// new one slides up from below to replace it, each digit position transitioning independently
// (exactly like a mechanical odometer/departure-board flip, not the whole number crossfading at once).
// `revealOnMount` controls AnimatePresence's own `initial` prop: false (the live-clock case) means a
// digit that's already correct when the component first mounts doesn't play an entrance — it only
// animates when its value actually changes afterward. true (the dashboard count-up case) means it
// always plays its entrance, including on that very first mount.
// leading-none (line-height: 1) on both the width/height reference and the animated glyph itself is
// what makes the height:1em wrapper below an exact fit — without it, the browser's default line-height
// (~1.2-1.5x font-size) renders a taller line box than the 1em wrapper allows, and overflow-hidden
// was clipping the difference off the numerals.
// GSAP's power2.inOut (ease-in-out: slow start, fast middle, slow settle) is what this app's other
// hand-rolled easing already borrows its "professional" feel from — cubic-bezier(0.65,0,0.35,1) is
// the closest standard CSS equivalent, and reads noticeably more deliberate than the expo-out curve
// this used before.
const DIGIT_EASE: [number, number, number, number] = [0.65, 0, 0.35, 1]
const DIGIT_DURATION_S = 0.55

function AnimatedDigit({ value, delay = 0, revealOnMount = false }: { value: string; delay?: number; revealOnMount?: boolean }) {
  return (
    <span className="relative inline-block overflow-hidden leading-none" style={{ height: '1em' }}>
      <span className="invisible leading-none">{value}</span>
      <AnimatePresence mode="popLayout" initial={revealOnMount}>
        <motion.span
          key={value}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: DIGIT_DURATION_S, delay, ease: DIGIT_EASE }}
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
    <span className={cn('inline-flex tabular-nums font-sans', className)} style={style}>
      {chars.map((ch, i) => (/\d/.test(ch) ? <AnimatedDigit key={i} value={ch} /> : <span key={i}>{ch}</span>))}
    </span>
  )
}

const DIGIT_STAGGER_S = 0.12

// Dashboard stat-card numbers: every CountUpNumber on the page reveals at the same moment (no
// cross-card, cross-number delay) — the only sequencing is *within* one number, left digit before
// right digit (e.g. "59" plays the 5 first, then the 9), via a per-digit-position delay.
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
  let digitPos = 0
  return (
    <span className={cn('inline-flex tabular-nums font-sans', className)} style={style}>
      {chars.map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i}>{ch}</span>
        const delay = digitPos * DIGIT_STAGGER_S
        digitPos += 1
        return <AnimatedDigit key={i} value={ch} delay={delay} revealOnMount />
      })}
    </span>
  )
}
