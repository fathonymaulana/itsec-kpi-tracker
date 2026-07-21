'use client'
import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { cn } from '@/lib/utils'

export type PinPhase = 'idle' | 'verifying' | 'success'

interface PinInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  phase?: PinPhase
  error?: boolean
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

const GLOW = '204,31,31' // #CC1F1F as an rgb triple, for building drop-shadow strings at various alphas

// Reproduces the reference clip's verify sequence, timed against what it actually shows frame by
// frame (not guessed): a neon stroke traces clockwise around each box's border starting from the
// top (~0.35s), the fully-drawn outline blooms outward and then breathes gently for as long as the
// request is actually in flight, and once it resolves, the digit dots vanish and all four boxes
// glide into the container's center — collapsing into one — where a checkmark fades in. GSAP (not
// framer-motion, used for the rest of this app's motion) drives all of it as one timeline per phase,
// matching this app's own convention for multi-element choreographed sequences (see
// components/ui/dialog.tsx's entrance/exit timelines).
export function PinInput({ length = 4, value, onChange, phase = 'idle', error = false, disabled = false, autoFocus = false, className }: PinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const boxRefs = useRef<(HTMLDivElement | null)[]>([])
  const strokeRefs = useRef<(SVGRectElement | null)[]>([])
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([])
  const checkRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)

  // Verifying: draw the outline on, then hold a slow breathing bloom for as long as this phase
  // lasts — real login latency is variable, so this can't be a fixed-length one-shot.
  useGSAP(() => {
    const strokes = strokeRefs.current.filter((el): el is SVGRectElement => !!el)
    if (phase !== 'verifying' || !strokes.length) return
    gsap.set(strokes, { strokeDashoffset: 1, opacity: 1, filter: `drop-shadow(0 0 0px rgba(${GLOW},0))` })
    const tl = gsap.timeline()
    tl.to(strokes, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' })
    tl.to(strokes, { filter: `drop-shadow(0 0 10px rgba(${GLOW},0.7))`, duration: 0.4, ease: 'sine.out' }, '-=0.05')
    tl.to(strokes, {
      filter: `drop-shadow(0 0 4px rgba(${GLOW},0.35))`,
      duration: 1,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    })
    return () => { tl.kill() }
  }, [phase])

  // Success: dots vanish, all four boxes glide toward the container's horizontal center (so they
  // visually merge into one), then a checkmark settles into the last box, which is the only one
  // left visible once they've converged.
  useGSAP(() => {
    const boxes = boxRefs.current.filter((el): el is HTMLDivElement => !!el)
    const dots = dotRefs.current.filter((el): el is HTMLSpanElement => !!el)
    if (phase !== 'success' || !boxes.length || !containerRef.current) return

    const containerRect = containerRef.current.getBoundingClientRect()
    const centerX = containerRect.left + containerRect.width / 2
    const targetX = boxes.map(box => {
      const r = box.getBoundingClientRect()
      return centerX - (r.left + r.width / 2)
    })

    const tl = gsap.timeline()
    if (dots.length) tl.to(dots, { opacity: 0, duration: 0.15, ease: 'sine.out' }, 0)
    tl.to(boxes, { x: i => targetX[i], duration: 0.4, ease: 'power3.inOut' }, 0.05)
    tl.to(boxes.slice(0, -1), { opacity: 0, duration: 0.18, ease: 'sine.in' }, '-=0.16')
    if (checkRef.current) {
      tl.fromTo(checkRef.current, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.8)' }, '-=0.08')
    }
    return () => { tl.kill() }
  }, [phase])

  return (
    <div ref={containerRef} className={cn('relative', className)} onClick={() => !disabled && inputRef.current?.focus()}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, length))}
        aria-label="4-digit PIN"
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className={cn('flex items-center justify-center gap-3 pointer-events-none', error && 'animate-pin-shake')}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < value.length
          const isActive = phase === 'idle' && focused && !disabled && !error && i === value.length
          const isLast = i === length - 1
          return (
            <div key={i} ref={el => { boxRefs.current[i] = el }} className="relative size-12">
              <div
                className={cn(
                  'relative flex size-12 items-center justify-center rounded-xl border-2 transition-colors duration-150',
                  error
                    ? 'border-[#CC1F1F] bg-danger-soft'
                    : phase !== 'idle'
                      ? 'border-transparent bg-panel-soft'
                      : isActive
                        ? 'border-[#CC1F1F] bg-panel'
                        : filled
                          ? 'border-ink/15 bg-panel-soft'
                          : 'border-dashed border-divider bg-transparent'
                )}
              >
                {filled && <span ref={el => { dotRefs.current[i] = el }} className="size-2.5 rounded-full bg-ink" />}
                {isLast && (
                  <div ref={checkRef} className="absolute inset-0 flex items-center justify-center opacity-0">
                    {/* Solar Icons has no bare checkmark glyph — every "Check" variant comes framed
                        in its own circle/square, which would double up with the box already drawn
                        here — so this is a plain hand-drawn check path instead. */}
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 10.5L8 14.5L16 6" stroke="#CC1F1F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
              {/* Neon trace overlay — a rounded-rect stroke with pathLength=1 so strokeDashoffset
                  always runs a clean 0→1 range regardless of the box's actual perimeter length,
                  independent of the border-2 CSS border underneath it (which stays transparent
                  once this takes over, rather than the two competing for the same edge). */}
              <svg
                viewBox="0 0 48 48"
                className="pointer-events-none absolute inset-0"
                style={{ opacity: phase === 'idle' || error ? 0 : 1 }}
              >
                <rect
                  ref={el => { strokeRefs.current[i] = el }}
                  x="2" y="2" width="44" height="44" rx="10"
                  fill="none"
                  stroke="#CC1F1F"
                  strokeWidth="2"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1}
                />
              </svg>
            </div>
          )
        })}
      </div>
    </div>
  )
}
