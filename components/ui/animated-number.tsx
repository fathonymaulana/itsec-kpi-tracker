'use client'
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
