'use client'
import { useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { CustomEase } from 'gsap/CustomEase'
import { cn } from '@/lib/utils'

gsap.registerPlugin(CustomEase)

// This app's own established "professional" curve (see AnimatedAside/SplashScreen/dialog.tsx,
// all using [0.16, 1, 0.3, 1] via framer-motion) — reused here as an actual GSAP ease via
// CustomEase so the pull-to-center glide reads consistently with the rest of the app's motion.
// pinPop is hand-tuned separately for the scale — noticeably overshoots past 1 before easing back,
// the actual "physics" part: a rounded-rect getting pulled in hard enough that it bulges past its
// resting size and springs back, rather than just sliding to a stop.
CustomEase.create('pinGlide', 'M0,0 C0.16,1 0.3,1 1,1')
CustomEase.create('pinPop', 'M0,0 C0.34,1.56 0.64,1 1,1')

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

// Perimeter of the box's own rounded-rect outline (x=2 y=2 w=44 h=44 rx=10 in a 48×48 viewBox) —
// the four straight edges (2*(44-2*10) each, twice over) plus the four quarter-circle corners
// (which together make one full circle of radius 10): 96 + 2π·10 ≈ 158.83. Used as the real
// stroke-dasharray/-dashoffset unit for the trace-in animation below, deliberately not the SVG2
// pathLength=1 normalization shortcut — GSAP tweens strokeDashoffset by writing it as a CSS
// property, and a bare "1" with no unit convention already established on the element is
// ambiguous enough (GSAP may default to appending "px") that the reveal silently snapped straight
// to its end state instead of visibly sweeping. Real user-space units sidestep that entirely.
const BOX_PERIMETER = 96 + 2 * Math.PI * 10

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
    gsap.set(strokes, { strokeDashoffset: BOX_PERIMETER, opacity: 1, filter: `drop-shadow(0 0 0px rgba(${GLOW},0))` })
    const tl = gsap.timeline()
    tl.to(strokes, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.out' })
    tl.to(strokes, { filter: `drop-shadow(0 0 10px rgba(${GLOW},0.7))`, duration: 0.4, ease: 'sine.out' }, '-=0.1')
    tl.to(strokes, {
      filter: `drop-shadow(0 0 4px rgba(${GLOW},0.35))`,
      duration: 1,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true,
    })
    return () => { tl.kill() }
  }, [phase])

  // Success: dots vanish, all four boxes glide toward the container's horizontal center — like
  // something is physically pulling them together, not just fading/sliding. Reference clip
  // (re-checked at 60fps for this pass) shows the first and last boxes picking up the most tilt as
  // they converge, everything overshooting past its resting scale before springing back, and only
  // then does a checkmark settle into the last box, the only one left visible once they've merged.
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
    // First/last box tilt hardest, the two inner ones less — a fan closing shut, not a flat slide.
    const TILT = [-14, -5, 5, 14]

    const tl = gsap.timeline()
    if (dots.length) tl.to(dots, { opacity: 0, duration: 0.15, ease: 'sine.out' }, 0)
    // Position glides in one continuous motion (this app's own signature curve, see pinGlide above)
    // — nothing needs to overshoot past center and slide back, that'd look like the boxes colliding.
    tl.to(boxes, { x: i => targetX[i], duration: 0.42, ease: 'pinGlide' }, 0.05)
    // Rotation and scale are the parts that actually get "pulled too far, then spring back" — tilt
    // in first, then straighten; grow past resting size, then settle. pinPop is this app's own
    // hand-tuned overshoot curve (a classic easeOutBack shape), used on the way back for both so the
    // spring-back reads as one connected motion rather than two independently-timed corrections.
    tl.to(boxes, { rotation: i => TILT[i], duration: 0.22, ease: 'pinGlide' }, 0.05)
    tl.to(boxes, { rotation: 0, duration: 0.25, ease: 'pinPop' }, '-=0.02')
    tl.to(boxes, { scale: 1.18, duration: 0.2, ease: 'sine.out' }, 0.05)
    tl.to(boxes, { scale: 1, duration: 0.25, ease: 'pinPop' }, '-=0.03')
    tl.to(boxes.slice(0, -1), { opacity: 0, duration: 0.18, ease: 'sine.in' }, '-=0.3')
    if (checkRef.current) {
      tl.fromTo(checkRef.current, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.8)' }, '-=0.15')
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
              {/* Neon trace overlay — a rounded-rect stroke, dasharray/dashoffset set to its real
                  perimeter (BOX_PERIMETER above) rather than SVG2's pathLength=1 normalization —
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
                  strokeDasharray={BOX_PERIMETER}
                  strokeDashoffset={BOX_PERIMETER}
                />
              </svg>
            </div>
          )
        })}
      </div>
    </div>
  )
}
