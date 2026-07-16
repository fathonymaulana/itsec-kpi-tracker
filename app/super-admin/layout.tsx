'use client'
import { TooltipProvider } from '@/components/ui/tooltip'

// Scoped to this portal only — the rest of the app doesn't use shadcn's Sidebar/Tooltip components.
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}
