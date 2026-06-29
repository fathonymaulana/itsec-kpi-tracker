'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Link2, Info } from 'lucide-react'

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

  const handleSave = () => {
    onSave(url, note)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-semibold text-[#1A1A1A] flex items-center gap-2">
            <Link2 size={16} className="text-[#CC1F1F]" />
            Data Source — {kpiName}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-[#F9F9F9] border border-[#EBEBEB] rounded p-3 flex gap-2 text-xs text-[#595959]">
          <Info size={14} className="shrink-0 mt-0.5 text-[#808080]" />
          <span>Provide a link to the source data (Google Drive, internal system, or website). Ensure Corporate Planning, HR, and the President Office have viewing access before submitting.</span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#595959] mb-1.5">
              Source Link <span className="text-[#CC1F1F]">*</span>
            </label>
            <Input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://drive.google.com/... or system URL"
              className="text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#595959] mb-1.5">
              Notes <span className="text-[#808080] font-normal">(sheet name, export date, etc.)</span>
            </label>
            <Input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Tab 'May 2026', exported 2026-06-01"
              className="text-sm"
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-[#595959]">
              I confirm that Corporate Planning, HR, and the President Office have viewing access to this link.
            </span>
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!url || !confirmed}
            onClick={handleSave}
            className="bg-[#CC1F1F] hover:bg-[#8B1A1A] text-white"
          >
            Save Source
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
