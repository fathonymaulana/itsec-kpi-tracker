import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Drop onto any clickable element that contains an icon for a designed, elastic "pop and wiggle"
// micro-interaction — no JS needed. `animate-icon-pop` (tailwind.config.ts) plays once whenever the
// hover: or active: variant starts matching, which is exactly a CSS animation restarting on selector
// re-match: hover: covers mouse hover on large screens, active: covers tap on touch devices (which
// never sustain :hover), matching each input method to its own trigger without JS device detection.
export const iconHoverClass =
  "[&_svg]:origin-center hover:[&_svg]:animate-icon-pop active:[&_svg]:animate-icon-pop"
