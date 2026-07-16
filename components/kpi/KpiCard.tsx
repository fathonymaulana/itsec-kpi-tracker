'use client'
import { useState } from 'react'
import { Link2, ChevronDown, ChevronUp } from 'lucide-react'
import { computeCalcValue } from '@/lib/calculations'
import { getStatus, getStatusColors } from '@/lib/status'
import { StatusBadge } from './StatusBadge'
import { AnomalyBadge } from './AnomalyBadge'
import { DataSourceModal } from './DataSourceModal'

interface SubMetric {
  id: number
  name: string
  unit: string
  is_calculated: number
  formula_key: string | null
  calc_input_positions: string | null
}

interface KpiCardProps {
  kpi: {
    id: number
    name: string
    target_text: string
    numeric_target: number | null
    direction: number
    sub_metrics: SubMetric[]
  }
  values: Record<number, string>           // sub_metric_id → raw string input
  dataSource?: { url: string; note: string }
  anomalyCount?: number
  readOnly?: boolean
  onValueChange?: (subMetricId: number, val: string) => void
  onDataSourceSave?: (kpiId: number, url: string, note: string) => void
  onAnomalyClick?: () => void
}

export function KpiCard({
  kpi,
  values,
  dataSource,
  anomalyCount = 0,
  readOnly = false,
  onValueChange,
  onDataSourceSave,
  onAnomalyClick,
}: KpiCardProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [dsOpen, setDsOpen] = useState(false)

  // Input sub-metrics in order (non-calc)
  const inputSMs = kpi.sub_metrics.filter(sm => !sm.is_calculated)
  // Calculated sub-metrics
  const calcSMs = kpi.sub_metrics.filter(sm => sm.is_calculated)

  // Resolve a calc sub-metric's value
  const resolveCalcValue = (sm: SubMetric): number | null => {
    if (!sm.formula_key) return null
    let positions: number[]
    if (sm.calc_input_positions) {
      positions = sm.calc_input_positions.split(',').map(p => parseInt(p.trim()) - 1)
    } else {
      // Default: pass all input sub-metrics in order (A=first, B=second, etc.)
      positions = inputSMs.map((_, i) => i)
    }
    const inputs = positions.map(pos => {
      const inputSm = inputSMs[pos]
      if (!inputSm) return null
      const raw = values[inputSm.id]
      const n = parseFloat(raw)
      return isNaN(n) ? null : n
    })
    return computeCalcValue(sm.formula_key, inputs)
  }

  // Compute the primary KPI metric value for status
  const primaryCalc = calcSMs[0]
  const primaryValue = primaryCalc ? resolveCalcValue(primaryCalc) : (() => {
    const first = inputSMs[0]
    if (!first) return null
    const raw = values[first.id]
    const n = parseFloat(raw)
    return isNaN(n) ? null : n
  })()

  const status = getStatus(primaryValue ?? null, kpi.numeric_target, kpi.direction)
  const statusColors = getStatusColors(status)

  const formatCalc = (val: number | null, unit: string): string => {
    if (val === null) return '—'
    if (unit === '%') return `${(val * 100).toFixed(1)}%`
    if (unit === 'x') return `${val.toFixed(2)}×`
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  return (
    <div
      className="bg-white border border-[#e5e5e5] rounded-3xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] overflow-hidden"
      style={{ borderLeftWidth: 3, borderLeftColor: statusColors.border }}
    >
      {/* Header */}
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-[#282828] text-sm">{kpi.name}</span>
            <StatusBadge status={status} />
            {anomalyCount > 0 && (
              <AnomalyBadge count={anomalyCount} onClick={onAnomalyClick} />
            )}
          </div>
          <div className="text-[#737373] text-xs mt-0.5 font-normal">Target: {kpi.target_text}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!readOnly && (
            <button
              onClick={() => setDsOpen(true)}
              className="flex items-center gap-1.5 text-xs font-normal px-2.5 py-1.5 border rounded-lg text-[#595959] border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:border-[#CC1F1F] hover:text-[#CC1F1F] transition-colors"
              title="Data source"
            >
              <Link2 size={12} />
              {dataSource?.url ? 'Source' : 'Add Source'}
            </button>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-[#AAAAAA] hover:text-[#595959] transition-colors"
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Sub-metrics */}
      {!collapsed && (
        <div className="border-t border-[#e5e5e5]">
          {inputSMs.map((sm, idx) => (
            <div key={sm.id} className={`flex items-center gap-4 px-6 py-2.5 ${idx % 2 === 0 ? 'bg-[#f5f5f5]' : 'bg-white'}`}>
              <div className="flex-1 text-xs text-[#595959] font-normal">{sm.name}</div>
              <div className="text-[10px] text-[#737373] w-8 text-right shrink-0">{sm.unit}</div>
              {readOnly ? (
                <div className="w-28 text-right text-sm font-normal text-[#282828]">
                  {values[sm.id] ? parseFloat(values[sm.id]).toLocaleString() : '—'}
                </div>
              ) : (
                <input
                  type="number"
                  step="any"
                  value={values[sm.id] ?? ''}
                  onChange={e => onValueChange?.(sm.id, e.target.value)}
                  placeholder="—"
                  className="w-28 text-right text-sm border border-[#e5e5e5] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-lg px-2 py-1 focus:outline-none focus:border-[#CC1F1F] bg-white font-normal text-[#282828] placeholder:text-[#CCCCCC]"
                />
              )}
            </div>
          ))}

          {calcSMs.map((sm, idx) => {
            const val = resolveCalcValue(sm)
            return (
              <div
                key={sm.id}
                className={`flex items-center gap-4 px-6 py-2.5 ${(inputSMs.length + idx) % 2 === 0 ? 'bg-[#f5f5f5]' : 'bg-white'}`}
              >
                <div className="flex-1 text-xs text-[#595959] font-normal">
                  {sm.name}
                  <span className="ml-1.5 text-[10px] text-[#737373]">(calculated)</span>
                </div>
                <div className="text-[10px] text-[#737373] w-8 text-right shrink-0">{sm.unit}</div>
                <div
                  className="w-28 text-right text-sm font-medium"
                  style={{ color: val !== null ? statusColors.text : '#737373' }}
                >
                  {formatCalc(val, sm.unit)}
                </div>
              </div>
            )
          })}

          {dataSource?.url && (
            <div className="px-6 py-2.5 bg-[#f5f5f5] border-t border-[#e5e5e5] flex items-center gap-2">
              <Link2 size={11} className="text-[#737373] shrink-0" />
              <a
                href={dataSource.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#595959] hover:text-[#CC1F1F] truncate"
              >
                {dataSource.url}
              </a>
              {dataSource.note && (
                <span className="text-[11px] text-[#737373] shrink-0">— {dataSource.note}</span>
              )}
            </div>
          )}
        </div>
      )}

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
    </div>
  )
}
