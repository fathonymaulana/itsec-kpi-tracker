"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CheckCircleLineDuotone,
  InfoCircleLineDuotone,
  DangerTriangleLineDuotone,
  DangerCircleLineDuotone,
  RefreshCircleLineDuotone,
} from "@solar-icons/react-perf"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CheckCircleLineDuotone size={18} className="text-[#0d9488]" />,
        info: <InfoCircleLineDuotone size={18} className="text-[#2563eb]" />,
        warning: <DangerTriangleLineDuotone size={18} className="text-warning" />,
        error: <DangerCircleLineDuotone size={18} className="text-[#CC1F1F]" />,
        loading: <RefreshCircleLineDuotone size={18} className="animate-spin text-ink-muted" />,
      }}
      style={
        {
          "--normal-bg": "white",
          "--normal-text": "#282828",
          "--normal-border": "#e5e5e5",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: "!bg-panel !border !shadow-[0_4px_16px_rgba(0,0,0,0.08)] !rounded-2xl",
          title: "!text-ink !font-medium",
          description: "!text-ink-muted",
          success: "!border-[#0d9488]/30",
          error: "!border-[#CC1F1F]/30",
          warning: "!border-[#B45309]/30",
          info: "!border-[#2563eb]/30",
          actionButton: "!bg-[#282828] !text-white",
          cancelButton: "!bg-panel-soft !text-ink-soft",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
