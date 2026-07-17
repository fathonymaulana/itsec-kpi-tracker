'use client'
import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  LinkMinimalisticLineDuotone as Link2,
  InfoCircleLineDuotone as Info,
  CloseSquareLineDuotone as X,
  DisketteLineDuotone as Save,
} from '@solar-icons/react-perf'

interface DataSourceModalProps {
  open: boolean
  onClose: () => void
  onSave: (url: string, note: string) => void
  initialUrl?: string
  initialNote?: string
  kpiName: string
}

export function DataSourceModal({ open, onClose, onSave, initialUrl = '', initialNote = '', kpiName }: DataSourceModalProps) {
  const [url, setUrl] = useState(initialUrl)
  const [note, setNote] = useState(initialNote)
  const [confirmed, setConfirmed] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const isDirty = url !== initialUrl || note !== initialNote || confirmed

  const handleSave = () => {
    onSave(url, note)
    onClose()
  }

  const handleCancel = () => {
    if (isDirty) setConfirmDiscard(true)
    else onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleCancel() }}>
      <DialogContent showCloseButton={false} className="max-w-[549px] rounded-[32px] p-6 gap-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="size-10 rounded-lg bg-panel border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center shrink-0">
              <Link2 size={18} className="text-[#EF3224]" />
            </div>
            <h2 className="text-xl font-semibold text-ink tracking-[-0.1px] leading-7 min-w-0">
              Data Source — {kpiName}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="size-10 rounded-full bg-[#282828] hover:bg-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center shrink-0 transition-colors"
          >
            <X size={16} className="text-white" />
          </button>
        </div>

        <div className="bg-panel-soft rounded-[20px] p-6 flex gap-3 items-start">
          <Info size={24} className="shrink-0 text-ink-muted" />
          <p className="text-xs text-ink-muted leading-4 text-justify">
            Provide a link to the source data (Google Drive, internal system, or website). Ensure Corporate Planning, HR, and the President Office have viewing access before submitting.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink">Source Link</label>
            <Input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Please enter your source link"
              className="h-9 rounded-lg border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-sm"
            />
            <p className="text-xs text-ink-muted leading-4">Please provide a brief description of the source link you are entering.</p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-ink">
              Notes <span className="text-ink-muted font-normal">(sheet name, export date, etc.)</span>
            </label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Tab 'May 2026', exported 2026-06-01"
              className="h-9 rounded-lg border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-sm"
            />
            <p className="text-xs text-ink-muted leading-4">Please provide a concise overview of the source link you are submitting.</p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} className="mt-0.5" />
            <span className="text-sm text-ink leading-[18px]">
              I confirm that Corporate Planning, HR, and the President Office have viewing access to this link.
            </span>
          </label>
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
            disabled={!url || !confirmed}
            onClick={handleSave}
            className="h-12 px-5 rounded-2xl bg-[#282828] hover:bg-[#171717] text-white font-medium gap-2"
          >
            Save Source
            <Save size={16} />
          </Button>
        </div>
      </DialogContent>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Discard this source?"
        description="The link and notes you entered haven't been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={onClose}
      />
    </Dialog>
  )
}
