'use client'
import { DangerTriangleLineDuotone } from '@solar-icons/react-perf'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn, iconHoverClass } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  destructive?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Go back',
  onConfirm,
  destructive = true,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-6 gap-5">
        <DialogHeader>
          <div className={cn('size-10 rounded-full flex items-center justify-center mb-1', destructive ? 'bg-danger-soft' : 'bg-panel-soft')}>
            <DangerTriangleLineDuotone size={20} className={destructive ? 'text-[#CC1F1F]' : 'text-ink'} />
          </div>
          <DialogTitle className="text-lg font-semibold text-ink">{title}</DialogTitle>
          <DialogDescription className="text-sm text-ink-muted">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="!mx-0 !mb-0 !bg-transparent !border-0 !p-0 flex gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={cn('h-11 px-5 rounded-2xl border-divider', iconHoverClass)}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={() => { onConfirm(); onOpenChange(false) }}
            className={cn(
              'h-11 px-5 rounded-2xl',
              destructive ? 'bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white' : 'bg-[#282828] hover:bg-[#171717] text-white',
              iconHoverClass
            )}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
