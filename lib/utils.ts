import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Drop onto any clickable element that contains an icon for a small, consistent hover lift —
// no JS needed, just a CSS transition on the descendant svg triggered by the parent's :hover.
// Uses the same expo-out cubic-bezier as the app's Framer Motion panels (AnimatedAside) so every
// hand-rolled CSS transition and every Framer Motion animation in the app reads as one consistent
// "professional" motion language; the slight rotate + press-down give it more character than a
// flat scale, and active:scale-95 adds tactile feedback on click.
export const iconHoverClass =
  "[&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-[cubic-bezier(0.16,1,0.3,1)] hover:[&_svg]:scale-[1.12] hover:[&_svg]:-rotate-6 active:[&_svg]:scale-95"
