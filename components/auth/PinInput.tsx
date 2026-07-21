'use client'
import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PinInputProps {
  length?: number
  value: string
  onChange: (value: string) => void
  loading?: boolean
  error?: boolean
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

// Idle: boxShadow collapses back to nothing. Loading: pulses outward and back, looping — same red
// as the rest of the brand (#CC1F1F), not the orange the reference clip used.
const GLOW_IDLE = { boxShadow: '0 0 0px 0px rgba(204,31,31,0)' }
const GLOW_PULSE = {
  boxShadow: [
    '0 0 0px 0px rgba(204,31,31,0)',
    '0 0 14px 3px rgba(204,31,31,0.5)',
    '0 0 0px 0px rgba(204,31,31,0)',
  ],
}

// A segmented 4-box PIN entry, backed by one real (invisible) input rather than four separate
// <input> elements — that single input is what actually gets focus, keyboard events, mobile numeric
// keypad, paste, and autofill; the boxes below are purely a visual readout of its value. Splitting
// into four real inputs would mean hand-rolling auto-advance/backspace-to-previous/paste-splitting
// ourselves, and getting all of that as reliable as the browser's native single-input handling is
// harder than it looks.
export function PinInput({ length = 4, value, onChange, loading = false, error = false, disabled = false, autoFocus = false, className }: PinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  return (
    <div className={cn('relative', className)} onClick={() => !disabled && inputRef.current?.focus()}>
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
          const isActive = focused && !disabled && !error && i === value.length
          return (
            <motion.div
              key={i}
              animate={loading ? GLOW_PULSE : GLOW_IDLE}
              transition={loading ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
              className={cn(
                'flex size-12 items-center justify-center rounded-xl border-2 transition-colors duration-150',
                error
                  ? 'border-[#CC1F1F] bg-danger-soft'
                  : isActive
                    ? 'border-[#CC1F1F] bg-panel'
                    : filled
                      ? 'border-ink/15 bg-panel-soft'
                      : 'border-dashed border-divider bg-transparent'
              )}
            >
              {/* Masked, not the raw digit — this is a persistent sign-in credential, not a
                  one-time SMS code, so it keeps the same "never show it back" posture the old
                  single type="password" input had. */}
              {filled && <span className="size-2.5 rounded-full bg-ink" />}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
