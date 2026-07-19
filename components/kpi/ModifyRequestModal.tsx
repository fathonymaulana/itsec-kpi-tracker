'use client'
import { useState, useEffect } from 'react'
import { LockUnlockedLineDuotone, SendSquareLineDuotone, CloseSquareLineDuotone } from '@solar-icons/react-perf'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface ModifyRequestModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
  kpiName: string
  submitting?: boolean
}

export function ModifyRequestModal({ open, onClose, onSubmit, kpiName, submitting = false }: ModifyRequestModalProps) {
  const [reason, setReason] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => { if (open) setReason('') }, [open])

  const handleCancel = () => {
    if (reason.trim()) setConfirmDiscard(true)
    else onClose()
  }

  const handleSubmit = () => {
    if (!reason.trim()) return
    onSubmit(reason.trim())
  }

  const handleClosed = () => {
    setReason('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleCancel() }}>
      <DialogContent showCloseButton={false} className="max-w-[520px] rounded-[32px] p-6 gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="size-10 rounded-lg bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center shrink-0">
              <LockUnlockedLineDuotone size={18} className="text-[#EF3224]" />
            </div>
            <h2 className="text-xl font-semibold text-ink tracking-[-0.1px] leading-7 min-w-0">
              Request to Modify — {kpiName}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="size-10 rounded-full bg-primary hover:bg-primary/80 shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center shrink-0 transition-colors"
          >
            <CloseSquareLineDuotone size={16} className="text-primary-foreground" />
          </button>
        </div>

        <div className="bg-panel-soft rounded-[20px] p-6 flex gap-3 items-start">
          <p className="text-xs text-ink-muted leading-4 text-justify">
            This month has already been submitted, so this matrix is locked. Explain why you need to change it —
            Corporate Planning will review your reason and either unlock just this matrix for editing or ask you to leave it as is. Everything else in the month stays submitted either way.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-ink">Reason for the change</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. The source spreadsheet had a typo in the marketing spend figure — corrected value attached."
            rows={4}
            className="w-full rounded-lg border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-sm p-3 resize-none focus:outline-none focus:border-[#CC1F1F]"
          />
          <p className="text-xs text-ink-muted leading-4">Be specific — this is what Corporate Planning sees when deciding whether to unlock this matrix.</p>
        </div>

        <div className="flex gap-4 justify-end">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="h-12 px-5 rounded-2xl border-divider text-ink-soft font-medium"
          >
            Cancel
          </Button>
          <Button
            disabled={!reason.trim() || submitting}
            onClick={handleSubmit}
            className="h-12 px-5 rounded-2xl bg-primary hover:bg-primary/80 text-primary-foreground font-medium gap-2"
          >
            {submitting ? 'Sending…' : 'Send Request'}
            <SendSquareLineDuotone size={16} />
          </Button>
        </div>
      </DialogContent>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this request?"
        description="The reason you typed hasn't been sent."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={handleClosed}
      />
    </Dialog>
  )
}
