'use client'
import { AnimatePresence, motion } from 'framer-motion'

interface SuccessMorphProps {
  /** Unique per distinct visual state (e.g. "idle" | "saving" | "saved") — changing it crossfades. */
  stateKey: string
  className?: string
  children: React.ReactNode
}

// Wraps a button's icon+label so switching between idle/loading/success states (Save -> Saving... ->
// Saved, Submit Month -> Submitting... -> Submitted) crossfades with a slight scale instead of
// snapping — the icon swap (e.g. a save icon becoming a checkmark) reads as one coordinated "morph"
// rather than a layout jump.
export function SuccessMorph({ stateKey, className, children }: SuccessMorphProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={stateKey}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={className ?? 'inline-flex items-center gap-2'}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  )
}
