import { computeCalcValue } from './calculations'
import { getStatus, worstStatus, type KpiStatus } from './status'

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
