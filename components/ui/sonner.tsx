"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CheckCircleLinear,
  InfoCircleLinear,
  DangerTriangleLinear,
  DangerCircleLinear,
  RefreshCircleLinear,
} from "@solar-icons/react-perf"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CheckCircleLinear size={16} />
        ),
        info: (
          <InfoCircleLinear size={16} />
        ),
        warning: (
          <DangerTriangleLinear size={16} />
        ),
        error: (
          <DangerCircleLinear size={16} />
        ),
        loading: (
          <RefreshCircleLinear size={16} className="animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
