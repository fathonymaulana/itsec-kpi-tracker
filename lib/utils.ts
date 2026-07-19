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

// Discord's own signature icon micro-interaction (designspells.com/spells/icon-micro-animations-
// when-hovered-or-clicked-in-discord): a circular icon badge morphs its own border-radius toward a
// rounded square on hover, then springs back on release; clicking adds a quick press-down bounce.
// transition-all (not a scoped transition-[...] list) is deliberate — these buttons already carry
// their own hover:bg-* color transition, and a second transition-property declaration for just
// border-radius/transform would silently replace it rather than combine, since transition-property
// itself isn't additive across classes. Meant for genuinely circular, standalone icon buttons
// (DeptTopNav's bell/panel-toggles/hamburger, MobileNavDrawer's close button) — pair with
// iconHoverClass on the same element for the icon's own opacity fade alongside the container morph.
export const discordIconClass =
  "rounded-full transition-all duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:rounded-2xl active:scale-90"
