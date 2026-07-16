import { computeCalcValue } from './calculations'

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
