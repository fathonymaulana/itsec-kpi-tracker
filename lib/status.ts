export type KpiStatus = 'on_track' | 'watch' | 'off_track' | 'no_data' | 'review_manually'

export function getStatus(
  actualValue: number | null | undefined,
  numericTarget: number | null | undefined,
  direction: number
): KpiStatus {
  if (actualValue === null || actualValue === undefined || isNaN(actualValue as number)) return 'no_data'
  if (numericTarget === null || numericTarget === undefined) return 'review_manually'
  if (direction === 0) return 'review_manually'

  const val = actualValue as number
  const tgt = numericTarget as number

  // Special case: target is 0 and lower is better (e.g. zero breaches)
  if (tgt === 0 && direction === -1) {
    return val === 0 ? 'on_track' : 'off_track'
  }

  if (direction === 1) {
    // Higher is better
    if (val >= tgt) return 'on_track'
    if (tgt > 0 && val >= tgt * 0.8) return 'watch'
    return 'off_track'
  } else {
    // direction === -1, lower is better
    if (val <= tgt) return 'on_track'
    if (tgt > 0 && val <= tgt * 1.2) return 'watch'
    return 'off_track'
  }
}

// Worst-first severity order — a KPI (or a group of independently-targeted sub-metrics within one
// KPI) shows the most urgent status among its parts, falling back to the best available signal when
// nothing is urgent. Shared by board summary, the dept dashboard, and KpiCard's per-sub-metric badges
// so "the KPI is off track" always means the same thing everywhere it's computed.
const SEVERITY: KpiStatus[] = ['off_track', 'watch', 'on_track', 'review_manually', 'no_data']
export function worstStatus(statuses: KpiStatus[]): KpiStatus {
  for (const s of SEVERITY) if (statuses.includes(s)) return s
  return 'no_data'
}

export function getStatusLabel(status: KpiStatus): string {
  const labels: Record<KpiStatus, string> = {
    on_track:        'On Track',
    watch:           'Watch',
    off_track:       'Off Track',
    no_data:         'No Data',
    review_manually: 'Review',
  }
  return labels[status]
}

// Colors are CSS custom-property references, not literal hex — that's what lets every consumer
// (StatusBadge, MonthGrid, KpiCard) respond to dark mode automatically, since inline style="color:#hex"
// never sees the .dark class but style="color:var(--x)" does.
export function getStatusColors(status: KpiStatus) {
  const map: Record<KpiStatus, { text: string; bg: string; border: string }> = {
    on_track:        { text: 'var(--success-text)', bg: 'var(--success-soft-bg)', border: 'var(--success-soft-border)' },
    watch:           { text: 'var(--warning-text)', bg: 'var(--warning-soft-bg)', border: 'var(--warning-soft-border)' },
    off_track:       { text: 'var(--danger-text)', bg: 'var(--danger-soft-bg)', border: 'var(--danger-soft-border)' },
    no_data:         { text: 'var(--no-data-text)', bg: 'var(--no-data-bg)', border: 'var(--no-data-border)' },
    review_manually: { text: 'var(--review-text)', bg: 'var(--review-bg)', border: 'var(--review-border)' },
  }
  return map[status]
}

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function getDefaultMonth(): number {
  const m = new Date().getMonth() // 0-indexed
  return m === 0 ? 12 : m // returns previous month (1-indexed)
}

export function getDefaultYear(): number {
  const d = new Date()
  return d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()
}
