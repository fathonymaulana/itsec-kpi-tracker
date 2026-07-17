import { computeCalcValue } from './calculations'
import { getStatus, worstStatus, type KpiStatus } from './status'
import { parsePeriod, periodRange, type Period } from './frequency'

export interface SubMetricLike {
  id: number
  is_calculated: number | boolean
  formula_key: string | null
  calc_input_positions: string | null
  numeric_target?: number | null
  direction?: number | null
}

// The one sub-metric that represents a KPI's headline outcome: its first calculated row if it has any,
// else its first raw input. Mirrors the selection every page used for the (now per-KPI) status badge
// before per-sub-metric status badges existed — kept here as the single source of truth so server routes
// (board summary) and client components agree on which value/target represents "the KPI".
export function getPrimarySubMetric<T extends SubMetricLike>(subMetrics: T[]): T | undefined {
  return subMetrics.find(sm => sm.is_calculated) ?? subMetrics[0]
}

export function resolvePrimaryValue<T extends SubMetricLike>(
  subMetrics: T[],
  valuesBySmId: Record<number, number>
): number | null {
  const inputSMs = subMetrics.filter(sm => !sm.is_calculated)
  const primary = getPrimarySubMetric(subMetrics)
  if (!primary) return null
  if (primary.is_calculated) {
    if (!primary.formula_key) return null
    const positions = primary.calc_input_positions
      ? primary.calc_input_positions.split(',').map(p => parseInt(p.trim(), 10) - 1)
      : inputSMs.map((_, i) => i)
    const inputs = positions.map(pos => {
      const inputSm = inputSMs[pos]
      if (!inputSm) return null
      const v = valuesBySmId[inputSm.id]
      return v === undefined ? null : v
    })
    return computeCalcValue(primary.formula_key, inputs)
  }
  const v = valuesBySmId[primary.id]
  return v === undefined ? null : v
}

// Resolves every sub-metric's value (not just the primary one) — raw inputs pass through, calculated
// rows run their formula. Used to drive a status per sub-metric for KPIs with more than one
// independently-targeted component (e.g. "≥4 agreements; ≥100 leads; ≥IDR5B pipeline" all in one KPI),
// where a single primary-sub-metric badge would hide whether the other two are actually on track.
export function resolveAllValues<T extends SubMetricLike>(
  subMetrics: T[],
  rawValuesBySmId: Record<number, number>
): Record<number, number | null> {
  const inputSMs = subMetrics.filter(sm => !sm.is_calculated)
  const result: Record<number, number | null> = {}
  for (const sm of subMetrics) {
    if (!sm.is_calculated) {
      result[sm.id] = rawValuesBySmId[sm.id] ?? null
      continue
    }
    if (!sm.formula_key) { result[sm.id] = null; continue }
    const positions = sm.calc_input_positions
      ? sm.calc_input_positions.split(',').map(p => parseInt(p.trim(), 10) - 1)
      : inputSMs.map((_, i) => i)
    const inputs = positions.map(pos => {
      const inputSm = inputSMs[pos]
      if (!inputSm) return null
      const v = rawValuesBySmId[inputSm.id]
      return v === undefined ? null : v
    })
    result[sm.id] = computeCalcValue(sm.formula_key, inputs)
  }
  return result
}

// A sub-metric only gets its own status if it carries its own numeric_target/direction — plain
// inputs that only feed a calculated row (and have no target of their own) are excluded, and don't
// influence the roll-up. `overall` is null when nothing on the KPI carries an individual target, so
// callers can fall back to the KPI-level numeric_target/direction for simple single-target KPIs.
export function getSubMetricStatuses<T extends SubMetricLike>(
  subMetrics: T[],
  valuesBySmId: Record<number, number | null>
): { bySmId: Record<number, KpiStatus>; overall: KpiStatus | null } {
  const targeted = subMetrics.filter(sm => sm.numeric_target != null && sm.direction != null)
  const bySmId: Record<number, KpiStatus> = {}
  for (const sm of targeted) {
    bySmId[sm.id] = getStatus(valuesBySmId[sm.id] ?? null, sm.numeric_target ?? null, sm.direction ?? 1)
  }
  const overall = targeted.length > 0 ? worstStatus(Object.values(bySmId)) : null
  return { bySmId, overall }
}

// Sums every raw input sub-metric's value across [startMonth, endMonth] (missing months contribute
// nothing, not null — a quarter that's only 1 month in still has a real running total), then re-runs
// every calculated sub-metric's formula on those summed inputs. This is the correct way to evaluate
// a quarter/year cumulatively: a ratio like "resolution rate" computed from summed numerator/denominator
// across the period is right, whereas averaging each month's already-computed rate would not be.
export function resolvePeriodValues<T extends SubMetricLike>(
  subMetrics: T[],
  actualsByMonth: Record<number, Record<number, number>>,
  startMonth: number,
  endMonth: number
): Record<number, number | null> {
  const inputSMs = subMetrics.filter(sm => !sm.is_calculated)
  const summed: Record<number, number | null> = {}
  for (const sm of inputSMs) {
    let sum: number | null = null
    for (let m = startMonth; m <= endMonth; m++) {
      const v = actualsByMonth[m]?.[sm.id]
      if (v !== undefined) sum = (sum ?? 0) + v
    }
    summed[sm.id] = sum
  }
  const result: Record<number, number | null> = { ...summed }
  for (const sm of subMetrics) {
    if (!sm.is_calculated) continue
    if (!sm.formula_key) { result[sm.id] = null; continue }
    const positions = sm.calc_input_positions
      ? sm.calc_input_positions.split(',').map(p => parseInt(p.trim(), 10) - 1)
      : inputSMs.map((_, i) => i)
    const inputs = positions.map(pos => {
      const inputSm = inputSMs[pos]
      return inputSm ? (summed[inputSm.id] ?? null) : null
    })
    result[sm.id] = computeCalcValue(sm.formula_key, inputs)
  }
  return result
}

export interface PeriodStatusResult {
  bySmId: Record<number, KpiStatus>
  overall: KpiStatus | null
  period: Period
  range: { start: number; end: number }
}

// The frequency-aware counterpart to getSubMetricStatuses: a KPI whose target is annual (e.g.
// "≥4 agreements/year") must not be judged off-track just because one month's raw entry is below 4 —
// it needs the whole year's entries summed first. Monthly-frequency KPIs behave exactly like
// getSubMetricStatuses(resolveAllValues(...)) since their period range is just the one month.
//
// Summing alone isn't enough, though: a running total is naturally below the full-period target for
// most of the period (1 of 4 agreements by March isn't "off track", it's on pace), so the target
// itself is prorated by how far `month` is into the period — full target only once the period's
// final month is reached. A zero target prorates to zero either way, so "no breaches allowed" style
// KPIs are unaffected.
export function getPeriodStatuses<T extends SubMetricLike>(
  subMetrics: T[],
  actualsByMonth: Record<number, Record<number, number>>,
  frequency: string | null | undefined,
  month: number
): PeriodStatusResult {
  const period = parsePeriod(frequency)
  const range = periodRange(period, month)
  const periodValues = resolvePeriodValues(subMetrics, actualsByMonth, range.start, range.end)

  const totalMonths = range.end - range.start + 1
  const elapsed = month - range.start + 1
  const paceFactor = elapsed / totalMonths // 1 on the period's final month — no leniency then

  const targeted = subMetrics.filter(sm => sm.numeric_target != null && sm.direction != null)
  const bySmId: Record<number, KpiStatus> = {}
  for (const sm of targeted) {
    const proratedTarget = period === 'monthly' ? sm.numeric_target! : sm.numeric_target! * paceFactor
    bySmId[sm.id] = getStatus(periodValues[sm.id] ?? null, proratedTarget, sm.direction ?? 1)
  }
  const overall = targeted.length > 0 ? worstStatus(Object.values(bySmId)) : null
  return { bySmId, overall, period, range }
}
