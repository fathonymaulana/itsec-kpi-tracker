'use client'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  LinkMinimalisticLineDuotone as Link2,
  DownloadLineDuotone as IconDownload,
  AltArrowDownLineDuotone as ChevronDown,
  AltArrowUpLineDuotone as ChevronUp,
  LockUnlockedLineDuotone as RequestModifyIcon,
  ClockCircleLineDuotone as PendingIcon,
  CheckCircleLineDuotone as ApprovedIcon,
  CloseCircleLineDuotone as RejectedIcon,
} from '@solar-icons/react-perf'
import { getStatus, getStatusColors } from '@/lib/status'
import { resolveAllValues, getSubMetricStatuses, getPeriodStatuses } from '@/lib/kpi-primary'
import { parsePeriod, periodLabel } from '@/lib/frequency'
import { useAuth, authHeaders } from '@/lib/auth'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from './StatusBadge'
import { DataSourceModal } from './DataSourceModal'
import { ModifyRequestModal } from './ModifyRequestModal'

interface SubMetric {
  id: number
  name: string
  unit: string
  is_calculated: number
  formula_key: string | null
  calc_input_positions: string | null
  numeric_target?: number | null
  direction?: number | null
}

interface KpiCardProps {
  kpi: {
    id: number
    name: string
    target_text: string
    numeric_target: number | null
    direction: number
    frequency?: string | null
    sub_metrics: SubMetric[]
  }
  values: Record<number, string>           // sub_metric_id → raw string input, for `month`
  // Whole-year actuals (month → sub_metric_id → value) driving period-cumulative status for
  // quarterly/annual-frequency KPIs — a monthly entry of 1 against a "≥4/year" target isn't off
  // track until the year's total is. Omitting these props falls back to single-month evaluation.
  yearActuals?: Record<number, Record<number, number>>
  month?: number
  dataSource?: { url: string; note: string }
  readOnly?: boolean
  onValueChange?: (subMetricId: number, val: string) => void
  onDataSourceSave?: (kpiId: number, url: string, note: string) => void
  // When set, a locked (readOnly) card shows a "Request Modify" CTA instead of collapse/expand —
  // only meaningful on the dept_head's own Data Entry page, not on Corporate Planning's read-only
  // review view, so this is opt-in rather than inferred from readOnly alone.
  modifyRequestStatus?: 'pending' | 'approved' | 'rejected' | null
  // Corporate Planning's rejection reason — shown right on the card so acting on it doesn't require
  // digging back through a notification that may have already been dismissed.
  modifyReviewNote?: string | null
  onRequestModify?: (kpiId: number, reason: string) => void
}

export function KpiCard({
  kpi,
  values,
  yearActuals,
  month,
  dataSource,
  readOnly = false,
  onValueChange,
  onDataSourceSave,
  modifyRequestStatus,
  modifyReviewNote,
  onRequestModify,
}: KpiCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [dsOpen, setDsOpen] = useState(false)
  const [modifyOpen, setModifyOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const { token } = useAuth()

  // A plain <a href download> only honors `download` for same-origin URLs — for external source
  // links (Google Drive, Dropbox, SharePoint, etc.) the browser just navigates instead of saving a
  // file. Routing through our own proxy (Content-Disposition: attachment) makes it same-origin from
  // the browser's perspective, so the file actually downloads regardless of where it's hosted.
  const handleDownloadSource = async () => {
    if (!dataSource?.url || !token) return
    setDownloading(true)
    try {
      const r = await fetch(`/api/download-source?url=${encodeURIComponent(dataSource.url)}`, { headers: authHeaders(token) })
      if (!r.ok) throw new Error('Download failed')
      const blob = await r.blob()
      const cd = r.headers.get('content-disposition') || ''
      const filename = cd.match(/filename="?([^"]+)"?/)?.[1] || 'source-file'
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error('Couldn’t download that source', { description: 'Try opening the link directly instead.' })
    } finally {
      setDownloading(false)
    }
  }

  // Input sub-metrics in order (non-calc)
  const inputSMs = kpi.sub_metrics.filter(sm => !sm.is_calculated)
  // Calculated sub-metrics
  const calcSMs = kpi.sub_metrics.filter(sm => sm.is_calculated)

  const numericValues = Object.fromEntries(
    Object.entries(values).map(([id, raw]) => [id, parseFloat(raw)]).filter(([, n]) => !isNaN(n as number))
  ) as Record<number, number>

  // What's actually displayed in each row is always this month's own value/formula result.
  const allValues = resolveAllValues(kpi.sub_metrics, numericValues)
  const resolveCalcValue = (sm: SubMetric): number | null => allValues[sm.id] ?? null

  // Status, however, uses the period-cumulative values when we know the KPI's frequency and have
  // the year's actuals to sum — falls back to plain single-month evaluation otherwise (matching the
  // pre-frequency-awareness behavior, e.g. for callers that only ever show one month at a time).
  const period = parsePeriod(kpi.frequency)
  const { bySmId: statusBySmId, overall } = yearActuals && month !== undefined
    ? getPeriodStatuses(
        kpi.sub_metrics,
        { ...yearActuals, [month]: { ...yearActuals[month], ...numericValues } },
        kpi.frequency,
        month
      )
    : getSubMetricStatuses(kpi.sub_metrics, allValues)

  const status = overall ?? getStatus(
    (() => {
      const primaryCalc = calcSMs[0]
      if (primaryCalc) return allValues[primaryCalc.id] ?? null
      const first = inputSMs[0]
      return first ? (allValues[first.id] ?? null) : null
    })(),
    kpi.numeric_target,
    kpi.direction
  )
  const statusColors = getStatusColors(status)

  const formatCalc = (val: number | null, unit: string): string => {
    if (val === null) return '—'
    if (unit === '%') return `${(val * 100).toFixed(1)}%`
    if (unit === 'x') return `${val.toFixed(2)}×`
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  return (
    <div
      className="bg-panel border border-divider rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: statusColors.border }}
    >
      {/* Header */}
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Small screens only: frequency reads above the title, not below it — flex-col-reverse
              flips the visual stack without touching DOM order, so this stays unchanged on md+. */}
          <div className="flex flex-col-reverse items-start gap-1 md:flex-row md:items-center md:gap-2 md:flex-wrap">
            <span className="font-medium text-ink text-sm">{kpi.name}</span>
            <span className="inline-flex items-center border border-divider bg-panel-soft text-ink-muted px-2.5 py-1 text-xs rounded font-medium tracking-wide">
              {periodLabel(period)}
            </span>
          </div>
          <div className="text-ink-muted text-xs mt-0.5 font-normal">Target: {kpi.target_text}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!readOnly && (
            <button
              onClick={() => setDsOpen(true)}
              className="flex items-center gap-1.5 text-xs font-normal px-2.5 py-1.5 border rounded-lg text-ink-soft border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-[#CC1F1F] hover:text-[#CC1F1F] transition-colors"
              title="Data source"
            >
              <Link2 size={12} />
              {dataSource?.url ? 'Source' : 'Add Source'}
            </button>
          )}
          {readOnly && (
            dataSource?.url ? (
              <button
                onClick={handleDownloadSource}
                disabled={downloading}
                className="flex items-center gap-1.5 text-xs font-normal px-2.5 py-1.5 border rounded-lg text-ink-soft border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-[#CC1F1F] hover:text-[#CC1F1F] transition-colors disabled:opacity-50 disabled:pointer-events-none"
                title="Download the data source file this department submitted"
              >
                <IconDownload size={12} />
                {downloading ? 'Downloading…' : 'Download Source'}
              </button>
            ) : (
              // Always render a source indicator in the reviewer view — an empty gap here reads as
              // "maybe I'm missing a button" rather than "this department genuinely didn't attach one."
              <span
                className="flex items-center gap-1.5 text-xs font-normal px-2.5 py-1.5 border rounded-lg text-ink-faint border-divider"
                title="This department didn't attach a data source for this KPI"
              >
                <Link2 size={12} />
                No source provided
              </span>
            )
          )}
          {readOnly && onRequestModify ? (
            modifyRequestStatus === 'pending' ? (
              <Badge variant="warning" className="h-auto px-2.5 py-1.5 text-xs">
                <PendingIcon size={12} />
                Pending Review
              </Badge>
            ) : modifyRequestStatus === 'approved' ? (
              <Badge variant="success" className="h-auto px-2.5 py-1.5 text-xs">
                <ApprovedIcon size={12} />
                Request Approved
              </Badge>
            ) : modifyRequestStatus === 'rejected' ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="danger" className="h-auto px-2.5 py-1.5 text-xs" title={modifyReviewNote ?? undefined}>
                  <RejectedIcon size={12} />
                  Request Rejected{modifyReviewNote ? `: ${modifyReviewNote}` : ''}
                </Badge>
                <button
                  onClick={() => setModifyOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-normal px-2.5 py-1.5 border rounded-lg text-ink-soft border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-[#CC1F1F] hover:text-[#CC1F1F] transition-colors"
                  title="Request permission to modify this matrix"
                >
                  <RequestModifyIcon size={12} />
                  Request Again
                </button>
              </div>
            ) : (
              <button
                onClick={() => setModifyOpen(true)}
                className="flex items-center gap-1.5 text-xs font-normal px-2.5 py-1.5 border rounded-lg text-ink-soft border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-[#CC1F1F] hover:text-[#CC1F1F] transition-colors"
                title="Request permission to modify this matrix"
              >
                <RequestModifyIcon size={12} />
                Request Modify
              </button>
            )
          ) : (
            <button
              onClick={() => setCollapsed(c => !c)}
              className="text-ink-faint hover:text-ink-soft transition-colors"
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Sub-metrics */}
      <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="border-t border-divider overflow-hidden"
        >
          {inputSMs.map((sm, idx) => (
            <div key={sm.id} className={`flex items-center gap-4 px-6 py-2.5 ${idx % 2 === 0 ? 'bg-panel-soft' : 'bg-panel'}`}>
              <div className="flex-1 text-xs text-ink-soft font-normal flex items-center gap-2 flex-wrap">
                {sm.name}
                {statusBySmId[sm.id] && <StatusBadge status={statusBySmId[sm.id]} size="sm" />}
              </div>
              <div className="text-[10px] text-ink-muted w-8 text-right shrink-0">{sm.unit}</div>
              {readOnly ? (
                <div className="w-28 text-right text-sm font-normal text-ink">
                  {values[sm.id] ? parseFloat(values[sm.id]).toLocaleString() : '—'}
                </div>
              ) : (
                <input
                  type="number"
                  step="any"
                  value={values[sm.id] ?? ''}
                  onChange={e => onValueChange?.(sm.id, e.target.value)}
                  placeholder="—"
                  className="w-28 text-right text-sm border border-divider shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-lg px-2 py-1 focus:outline-none focus:border-[#CC1F1F] bg-panel font-normal text-ink placeholder:text-ink-faint"
                />
              )}
            </div>
          ))}

          {calcSMs.map((sm, idx) => {
            const val = resolveCalcValue(sm)
            return (
              <div
                key={sm.id}
                className={`flex items-center gap-4 px-6 py-2.5 ${(inputSMs.length + idx) % 2 === 0 ? 'bg-panel-soft' : 'bg-panel'}`}
              >
                <div className="flex-1 text-xs text-ink-soft font-normal flex items-center gap-2 flex-wrap">
                  {sm.name}
                  <span className="text-[10px] text-ink-muted">(calculated)</span>
                  {statusBySmId[sm.id] && <StatusBadge status={statusBySmId[sm.id]} size="sm" />}
                </div>
                <div className="text-[10px] text-ink-muted w-8 text-right shrink-0">{sm.unit}</div>
                <div
                  className="w-28 text-right text-sm font-medium"
                  style={{ color: val !== null ? getStatusColors(statusBySmId[sm.id] ?? status).text : 'var(--ink-muted)' }}
                >
                  {formatCalc(val, sm.unit)}
                </div>
              </div>
            )
          })}

          {dataSource?.url && (
            <div className="px-6 py-2.5 bg-panel-soft border-t border-divider flex items-center gap-2">
              <Link2 size={11} className="text-ink-muted shrink-0" />
              <a
                href={dataSource.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-ink-soft hover:text-[#CC1F1F] truncate"
              >
                {dataSource.url}
              </a>
              {dataSource.note && (
                <span className="text-[11px] text-ink-muted shrink-0">— {dataSource.note}</span>
              )}
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {!readOnly && (
        <DataSourceModal
          open={dsOpen}
          onClose={() => setDsOpen(false)}
          onSave={(url, note) => onDataSourceSave?.(kpi.id, url, note)}
          initialUrl={dataSource?.url ?? ''}
          initialNote={dataSource?.note ?? ''}
          kpiName={kpi.name}
        />
      )}

      {readOnly && onRequestModify && (
        <ModifyRequestModal
          open={modifyOpen}
          onClose={() => setModifyOpen(false)}
          onSubmit={(reason) => { onRequestModify(kpi.id, reason); setModifyOpen(false) }}
          kpiName={kpi.name}
        />
      )}
    </div>
  )
}
