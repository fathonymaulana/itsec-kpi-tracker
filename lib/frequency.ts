// KPIs store frequency as free-text pulled straight from the source workbook (e.g. "Monthly",
// "Quarterly, Annually", "Monthly, Quarterly, Annually") — never a clean single enum. For status
// evaluation what matters is the BROADEST period mentioned, since that's the period the KPI's own
// target number describes (a target_text like "≥4 agreements/year" is an annual target even if the
// department happens to report progress monthly too).
export type Period = 'monthly' | 'quarterly' | 'biannual' | 'annual'

export function parsePeriod(frequency: string | null | undefined): Period {
  const f = (frequency || '').toLowerCase()
  if (f.includes('annual') && !f.includes('bi-annual') && !f.includes('biannual')) return 'annual'
  if (f.includes('bi-annual') || f.includes('biannual')) return 'biannual'
  if (f.includes('quarterly')) return 'quarterly'
  return 'monthly'
}

export function periodLabel(period: Period): string {
  return { monthly: 'Monthly', quarterly: 'Quarterly', biannual: 'Bi-Annually', annual: 'Annually' }[period]
}

// The [start, end] month range (1-12, inclusive) that `month` falls within for a given period —
// e.g. quarterly + month=5 (May) -> Q2 -> [4, 6]. Monthly periods are always a single month.
export function periodRange(period: Period, month: number): { start: number; end: number } {
  switch (period) {
    case 'annual':
      return { start: 1, end: 12 }
    case 'biannual':
      return month <= 6 ? { start: 1, end: 6 } : { start: 7, end: 12 }
    case 'quarterly': {
      const q = Math.floor((month - 1) / 3)
      return { start: q * 3 + 1, end: q * 3 + 3 }
    }
    default:
      return { start: month, end: month }
  }
}
