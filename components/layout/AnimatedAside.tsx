'use client'
import { AnimatePresence, motion } from 'framer-motion'

// A "professional" cubic-bezier — the same expo-out curve Vercel/Linear use for panel/sheet
// transitions: fast to start, settles smoothly with no overshoot or bounce.
const EASE = [0.16, 1, 0.3, 1] as const

interface AnimatedAsideProps {
  open: boolean
  width: number
  side: 'left' | 'right'
  /** Display/visibility classes only (e.g. `hidden md:block`) — applied to the clipping outer box. */
  className?: string
  /** Padding/scroll/etc. classes for the content itself — applied to the fixed-width inner box, so
   *  padding is baked into the same `width` the outer box animates to and clips against. Applying
   *  padding on the outer box instead would shrink its content area below `width` while the inner
   *  box still rendered at the full `width`, clipping real content off the trailing edge. */
  contentClassName?: string
  children: React.ReactNode
}

export function AnimatedAside({ open, width, side, className, contentClassName, children }: AnimatedAsideProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className={`shrink-0 overflow-hidden ${className ?? ''}`}
          style={{ [side === 'left' ? 'marginRight' : 'marginLeft']: 0 }}
        >
          <div style={{ width }} className={`h-full ${contentClassName ?? ''}`}>
            {children}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
