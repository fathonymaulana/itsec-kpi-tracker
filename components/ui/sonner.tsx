"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CheckCircleLineDuotone,
  InfoCircleLineDuotone,
  DangerTriangleLineDuotone,
  DangerCircleLineDuotone,
  RefreshCircleLineDuotone,
} from "@solar-icons/react-perf"

// `next-themes` (sonner's usual theme source) is installed but this app never mounts its
// ThemeProvider — dark mode here is a plain `.dark` class toggled on <html> by AddOnsPanel. Reading
// useTheme() without a provider always returns the default, so it silently tracked the OS's
// prefers-color-scheme instead of this app's own toggle. Watching the class directly is the
// actual source of truth.
function useIsDark() {
  const [isDark, setIsDark] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    setIsDark(root.classList.contains("dark"))
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")))
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

const Toaster = ({ ...props }: ToasterProps) => {
  const isDark = useIsDark()

  return (
    <Sonner
      theme={isDark ? "dark" : "light"}
      className="toaster group"
      icons={{
        success: <CheckCircleLineDuotone size={18} className="text-[#0d9488]" />,
        info: <InfoCircleLineDuotone size={18} className="text-[#2563eb]" />,
        warning: <DangerTriangleLineDuotone size={18} className="text-warning" />,
        error: <DangerCircleLineDuotone size={18} className="text-[#CC1F1F]" />,
        loading: <RefreshCircleLineDuotone size={18} className="animate-spin text-ink-muted" />,
      }}
      style={{ "--border-radius": "1rem" } as React.CSSProperties}
      toastOptions={{
        unstyled: false,
        classNames: {
          // bg-panel/text-ink/text-ink-muted already resolve through this app's theme-aware tokens,
          // so overriding sonner's own --normal-bg/--normal-text (fixed white/#282828, previously
          // hardcoded here) is redundant now that the theme prop itself is correct — removed rather
          // than left in place to fight the classNames below.
          toast: "!bg-panel !border !shadow-[0_4px_16px_rgba(0,0,0,0.08)] !rounded-2xl",
          title: "!text-ink !font-medium",
          description: "!text-ink-muted",
          success: "!border-[#0d9488]/30",
          error: "!border-[#CC1F1F]/30",
          warning: "!border-[#B45309]/30",
          info: "!border-[#2563eb]/30",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-panel-soft !text-ink-soft",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
