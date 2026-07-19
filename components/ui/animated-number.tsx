'use client'
import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

// YouTube's own like/view counter animation (designspells.com/spells/like-and-view-count-animation-
// in-youtube): each digit position renders a full 0-9 column and slides via a single CSS `transform:
// translateY()` transition to bring the target digit into view — one continuous GPU-accelerated
// transform per digit, not a JS loop stepping through intermediate values. Digits with a bigger
// distance to travel visually move faster within the same fixed duration, which is what makes a bank
// of these read as one coordinated animation instead of independently-timed pieces.
const DIGIT_EASE = 'cubic-bezier(0.62,0.05,0.01,0.99)'
const DIGIT_DURATION_S = 0.3

function DigitColumn({ digit, animateFromZero = false, duration = DIGIT_DURATION_S }: { digit: number; animateFromZero?: boolean; duration?: number }) {
  const [pos, setPos] = useState(() => (animateFromZero ? 0 : digit))
  const firstRun = useRef(true)

  useEffect(() => {
    if (firstRun.current && animateFromZero) {
      firstRun.current = false
      const raf = requestAnimationFrame(() => setPos(digit))
      return () => cancelAnimationFrame(raf)
    }
    firstRun.current = false
    setPos(digit)
  }, [digit, animateFromZero])

  return (
    <span className="relative inline-block overflow-hidden leading-none" style={{ height: '1em' }}>
      <span className="invisible leading-none">0</span>
      <span
        className="absolute inset-0 flex flex-col leading-none"
        style={{ transform: `translateY(-${pos}em)`, transition: `transform ${duration}s ${DIGIT_EASE}` }}
      >
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="leading-none" style={{ height: '1em' }}>{i}</span>
        ))}
      </span>
    </span>
  )
}

// Drop-in replacement for rendering a number/time string with the digit-column roll above. Only
// digit characters (0-9) get a column — punctuation (":", ".", "%") stays static since it never
// "changes value" the same way. items-baseline + leading-none keeps static characters (e.g. the "%"
// in "75%") level with the digit columns next to them instead of drifting off the shared baseline.
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
      {chars.map((ch, i) => (/\d/.test(ch) ? <DigitColumn key={i} digit={parseInt(ch, 10)} /> : <span key={i} className="leading-none">{ch}</span>))}
    </span>
  )
}

// Dashboard stat-card numbers: every digit column starts at 0 and slides to its target on mount, all
// in the same fixed 300ms — the YouTube counter's own animation applied to a static reveal instead
// of a live-updating value.
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
  return (
    <span className={cn('inline-flex items-baseline tabular-nums font-sans', className)} style={style}>
      {chars.map((ch, i) => (/\d/.test(ch) ? <DigitColumn key={i} digit={parseInt(ch, 10)} animateFromZero /> : <span key={i} className="leading-none">{ch}</span>))}
    </span>
  )
}
