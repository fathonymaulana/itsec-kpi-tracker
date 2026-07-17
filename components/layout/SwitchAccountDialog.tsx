'use client'
import { useState, MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { TransferHorizontalLineDuotone as ArrowLeftRight, AltArrowRightLineDuotone as ChevronRight, CloseCircleLineDuotone as X } from '@solar-icons/react-perf'
import { useAuth } from '@/lib/auth'
import { getAccountHistory, forgetAccount, type AccountHistoryEntry } from '@/lib/account-history'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn, iconHoverClass } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  corp_planning: 'Corporate Planning',
  dept_head: 'Department Head',
}

interface SwitchAccountDialogProps {
  className?: string
  /** Supply a custom trigger element; receives the click handler to open the dialog. Falls back to a dark-header icon+label button. */
  renderTrigger?: (onClick: () => void) => React.ReactNode
}

export function SwitchAccountDialog({ className, renderTrigger }: SwitchAccountDialogProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<AccountHistoryEntry[]>([])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setHistory(getAccountHistory().filter(e => e.user_id !== user?.user_id))
  }

  const handlePick = (entry: AccountHistoryEntry) => {
    setOpen(false)
    logout()
    router.push(`/login?user=${entry.user_id}`)
  }

  const handleForget = (e: MouseEvent, user_id: number) => {
    e.stopPropagation()
    forgetAccount(user_id)
    setHistory(prev => prev.filter(h => h.user_id !== user_id))
  }

  const openDialog = () => handleOpenChange(true)

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openDialog)
      ) : (
        <button
          onClick={openDialog}
          className={cn(
            'flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-normal px-2.5 py-1.5 rounded hover:bg-white/10 transition-colors',
            iconHoverClass,
            className
          )}
          title="Switch Account"
        >
          <ArrowLeftRight size={13} />
          <span className="hidden sm:inline">Switch Account</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Account</DialogTitle>
            <DialogDescription>
              Pick an account you&apos;ve used on this device. You&apos;ll still need its PIN to continue — we never skip that step.
            </DialogDescription>
          </DialogHeader>

          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center px-4">
              No other accounts have signed in on this device yet. Once a teammate signs in here, they&apos;ll show up for quick switching.
            </div>
          ) : (
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto -mx-1 px-1">
              {history.map(entry => (
                <button
                  key={entry.user_id}
                  onClick={() => handlePick(entry)}
                  className="group flex items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-muted transition-colors"
                >
                  <Avatar size="sm">
                    {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.name} />}
                    <AvatarFallback className="text-[10px]">{entry.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{entry.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {entry.role === 'dept_head' ? (entry.dept_name || 'Department Head') : (ROLE_LABELS[entry.role] ?? entry.role)}
                    </div>
                  </div>
                  <span
                    onClick={(e) => handleForget(e, entry.user_id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1 rounded transition-opacity"
                    title="Remove from list"
                  >
                    <X size={13} />
                  </span>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
