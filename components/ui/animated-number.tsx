'use client'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// One digit's own independent "odometer" slot — the old digit slides up and fades out while the
// new one slides up from below to replace it, each digit position transitioning independently
// (exactly like a mechanical odometer/departure-board flip, not the whole number crossfading at once).
function AnimatedDigit({ value }: { value: string }) {
  return (
    <span className="relative inline-block overflow-hidden" style={{ height: '1em' }}>
      <span className="invisible">{value}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
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
    <span className={cn('inline-flex tabular-nums', className)} style={style}>
      {chars.map((ch, i) => (/\d/.test(ch) ? <AnimatedDigit key={i} value={ch} /> : <span key={i}>{ch}</span>))}
    </span>
  )
}

const COUNT_UP_DURATION_MS = 700
const COUNT_UP_STEP_MS = 60

// Counts up from 0 to `value` on mount, riding the same per-digit roll as AnimatedNumber for each
// intermediate step (a controlled step interval, not requestAnimationFrame — updating every frame
// would fire the digit-roll transition too fast to read as anything but a blur). `sequenceIndex`
// staggers a whole page of these so number N only starts once number N-1's animation has finished —
// every instance sharing COUNT_UP_DURATION_MS as its per-step budget is what makes
// `sequenceIndex * COUNT_UP_DURATION_MS` line up exactly on the trailing edge of the previous one.
export function CountUpNumber({
  value,
  sequenceIndex = 0,
  formatter,
  className,
  style,
}: {
  value: number
  sequenceIndex?: number
  formatter?: (n: number) => string
  className?: string
  style?: CSSProperties
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const steps = Math.max(1, Math.round(COUNT_UP_DURATION_MS / COUNT_UP_STEP_MS))
    let step = 0
    let intervalId: ReturnType<typeof setInterval> | undefined
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        step++
        const progress = Math.min(1, step / steps)
        const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic — decelerates into the final value
        setDisplay(Math.round(eased * value))
        if (progress >= 1 && intervalId) clearInterval(intervalId)
      }, COUNT_UP_STEP_MS)
    }, sequenceIndex * COUNT_UP_DURATION_MS)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [value, sequenceIndex])

  return <AnimatedNumber value={formatter ? formatter(display) : display} className={className} style={style} />
}
