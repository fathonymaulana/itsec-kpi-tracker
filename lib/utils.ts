import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Drop onto any clickable element that contains an icon for a small, consistent hover lift —
// no JS needed, just a CSS transition on the descendant svg triggered by the parent's :hover.
export const iconHoverClass = "[&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out hover:[&_svg]:scale-110"
