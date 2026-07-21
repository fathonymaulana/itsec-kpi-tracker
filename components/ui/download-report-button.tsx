'use client'
import { useState } from 'react'
import {
  DownloadLineDuotone as IconDownload,
  DocumentTextLineDuotone as IconPdf,
  FileLineDuotone as IconXlsx,
} from '@solar-icons/react-perf'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { buttonVariants } from '@/components/ui/button'
import { cn, iconHoverClass } from '@/lib/utils'

export interface ReportColumn {
  key: string
  label: string
  width?: number
}

interface DownloadReportButtonProps {
  title: string
  filename: string
  columns: ReportColumn[]
  rows: Record<string, string | number>[]
  className?: string
}

// Shared "Download Report" CTA for every dashboard/data-entry page — PDF via jspdf/jspdf-autotable,
// Excel via exceljs (already used for Super Admin's Export XLSX). Both libraries are dynamically
// imported so neither adds to the page's initial bundle until the user actually picks a format.
export function DownloadReportButton({ title, filename, columns, rows, className }: DownloadReportButtonProps) {
  const [exporting, setExporting] = useState<'pdf' | 'xlsx' | null>(null)

  const handlePdf = async () => {
    setExporting('pdf')
    try {
      const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const doc = new JsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' })
      doc.setFontSize(13)
      doc.text(title, 14, 15)
      doc.setFontSize(9)
      doc.setTextColor(120)
      doc.text(`Generated ${new Date().toLocaleString()}`, 14, 21)
      autoTable(doc, {
        startY: 26,
        head: [columns.map(c => c.label)],
        body: rows.map(r => columns.map(c => String(r[c.key] ?? ''))),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [23, 23, 23] },
      })
      doc.save(`${filename}.pdf`)
    } finally {
      setExporting(null)
    }
  }

  const handleXlsx = async () => {
    setExporting('xlsx')
    try {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Report')
      ws.columns = columns.map(c => ({ header: c.label, key: c.key, width: c.width ?? 22 }))
      ws.getRow(1).font = { bold: true }
      rows.forEach(r => ws.addRow(r))
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!!exporting || rows.length === 0}
        className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'shadow-xs disabled:opacity-50 disabled:pointer-events-none', iconHoverClass, className)}
      >
        <IconDownload size={15} className="mr-1.5" />
        {exporting ? 'Exporting…' : 'Download Report'}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handlePdf}>
          <IconPdf size={14} /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleXlsx}>
          <IconXlsx size={14} /> Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
