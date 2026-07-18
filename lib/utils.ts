import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Drop onto any clickable element that contains an icon for a restrained hover/press feel — no
// scale, no rotate, no vertical movement (explicitly asked against all three). Just a plain
// opacity fade. Icon-only buttons additionally pair this with a Tooltip (components/ui/tooltip.tsx)
// for the actual "what does this do" affordance, rather than leaning on the motion itself.
export const iconHoverClass =
  "[&_svg]:transition-opacity [&_svg]:duration-200 hover:[&_svg]:opacity-70 active:[&_svg]:opacity-50"
