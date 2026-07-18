import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Drop onto any clickable element that contains an icon for a restrained hover/press lift — no
// scale, no rotate (explicitly asked against both). Just a small upward translate on hover that
// settles back down on press, using the same expo-out cubic-bezier as the app's Framer Motion
// panels (AnimatedAside) so every hand-rolled CSS transition reads as the same motion language.
// Icon-only buttons additionally pair this with a Tooltip (components/ui/tooltip.tsx) for the
// actual "what does this do" affordance, rather than leaning on the motion itself to communicate.
export const iconHoverClass =
  "[&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-[cubic-bezier(0.16,1,0.3,1)] hover:[&_svg]:-translate-y-0.5 active:[&_svg]:translate-y-0"
