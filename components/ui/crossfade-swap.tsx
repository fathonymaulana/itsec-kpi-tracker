'use client'
import { AnimatePresence, motion } from 'framer-motion'

interface CrossfadeSwapProps {
  /** true once real content is ready — false shows `skeleton` instead. */
  show: boolean
  skeleton: React.ReactNode
  children: React.ReactNode
}

// Every page in this app swapped its skeleton for real content with an instant, jarring cut. This
// crossfades the two instead — skeleton fades out while content fades + settles in from a slight
// scale, using the same expo-out curve as the rest of the app's motion (AnimatedAside, dialogs).
export function CrossfadeSwap({ show, skeleton, children }: CrossfadeSwapProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {show ? (
        <motion.div
          key="content"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      ) : (
        <motion.div key="skeleton" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {skeleton}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
