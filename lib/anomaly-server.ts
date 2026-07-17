import 'server-only'
import { supabaseServer } from './supabase-server'

interface DetectedAnomaly {
  id: number
  sub_metric_id: number
  type: string
  description: string
}

interface AnomalyCheckInput {
  sub_metric_id: number
  kpi_id: number
  year: number
  month: number
  value: number
}

// Batched anomaly detection for a set of actuals that were just saved together (always the
// same year/month — one Data Entry save is always a single month). Gathers all history/lookup
// data with a handful of `.in(...)` queries up front instead of the 3-10 sequential round-trips
// per value that the old per-row detectAnomalies() did — that was the main reason Save/Submit
// felt slow with more than a few sub-metrics.
export async function detectAnomaliesBatch(inputs: AnomalyCheckInput[]): Promise<DetectedAnomaly[]> {
  const detected: DetectedAnomaly[] = []
  if (inputs.length === 0) return detected

  const supabase = supabaseServer()
  const smIds = Array.from(new Set(inputs.map(i => i.sub_metric_id)))
  const kpiIds = Array.from(new Set(inputs.map(i => i.kpi_id)))
  const year = inputs[0].year
  const month = inputs[0].month

  try {
    const [{ data: prevRows }, { data: existingAnomalies }, { data: smRows }, { data: kpiRows }] = await Promise.all([
      supabase
        .from('actuals')
        .select('sub_metric_id, month, value')
        .in('sub_metric_id', smIds).eq('year', year).lt('month', month)
        .not('value', 'is', null)
        .order('month', { ascending: false }),
      supabase
        .from('anomalies')
        .select('sub_metric_id, anomaly_type')
        .in('sub_metric_id', smIds).eq('year', year).eq('month', month).eq('dismissed', false),
      supabase.from('sub_metrics').select('id, name, is_calc').in('id', smIds),
      supabase.from('kpis').select('id, kpi_name').in('id', kpiIds),
    ])

    const smById = new Map((smRows || []).map(sm => [sm.id, sm]))
    const kpiById = new Map((kpiRows || []).map(k => [k.id, k]))

    const existingTypesBySm = new Map<number, Set<string>>()
    for (const a of existingAnomalies || []) {
      if (!existingTypesBySm.has(a.sub_metric_id)) existingTypesBySm.set(a.sub_metric_id, new Set())
      existingTypesBySm.get(a.sub_metric_id)!.add(a.anomaly_type)
    }

    // Rows are already ordered by month desc globally, which preserves descending order within
    // each sub_metric_id group once split out — so the first 3 entries per group are its latest 3 months.
    const prevBySm = new Map<number, number[]>()
    for (const r of prevRows || []) {
      if (!prevBySm.has(r.sub_metric_id)) prevBySm.set(r.sub_metric_id, [])
      prevBySm.get(r.sub_metric_id)!.push(Number(r.value))
    }

    const flagsToInsert: { sub_metric_id: number; year: number; month: number; anomaly_type: string; description: string }[] = []

    for (const input of inputs) {
      const { sub_metric_id, kpi_id, value } = input
      const existingTypes = existingTypesBySm.get(sub_metric_id) ?? new Set<string>()
      const prev3 = (prevBySm.get(sub_metric_id) ?? []).slice(0, 3)
      const prevMonth = prev3.length > 0 ? prev3[0] : null
      const sm = smById.get(sub_metric_id)
      const kpi = kpiById.get(kpi_id)

      const tryFlag = (type: string, description: string) => {
        if (existingTypes.has(type)) return
        existingTypes.add(type) // also dedupes within this same batch
        flagsToInsert.push({ sub_metric_id, year, month, anomaly_type: type, description })
      }

      // 1. Spike: > 3x avg of prev 3 months
      if (prev3.length >= 2) {
        const avg = prev3.reduce((a, b) => a + b, 0) / prev3.length
        if (avg > 0 && value > avg * 3) {
          tryFlag('spike', `Value ${value.toLocaleString()} is more than 3× the previous ${prev3.length}-month average (${avg.toFixed(2)}).`)
        }
      }

      // 2. Drop: < 25% of previous month
      if (prevMonth !== null && prevMonth > 0 && value < prevMonth * 0.25) {
        tryFlag('drop', `Value ${value.toLocaleString()} is less than 25% of previous month value (${prevMonth.toLocaleString()}).`)
      }

      // 3. Zero after consecutive non-zero data
      if (value === 0 && prev3.filter(v => v > 0).length >= 2) {
        tryFlag('zero_after_data', `Value is 0 after ${prev3.filter(v => v > 0).length} consecutive months of non-zero data.`)
      }

      // 4. Impossible value: rate entered as whole number, or negative count
      if (sm && !sm.is_calc) {
        const nameLower = String(sm.name).toLowerCase()
        if ((nameLower.includes('%') || nameLower.includes('rate') || nameLower.includes('ratio')) && value > 1.5) {
          tryFlag('impossible_value', `Rate/ratio value ${value} exceeds 150% — likely entered as a whole number (enter 0.85 not 85).`)
        }
        if ((nameLower.includes('no.') || nameLower.startsWith('(') || nameLower.includes('number')) && value < 0) {
          tryFlag('impossible_value', `Count value ${value} is negative — please check data entry.`)
        }
      }

      // 5. MoM drop > 50% on revenue/sales KPIs
      if (prevMonth !== null && prevMonth > 0 && value < prevMonth * 0.5) {
        const kpiName = String(kpi?.kpi_name || '').toLowerCase()
        if (kpiName.includes('revenue') || kpiName.includes('sales') || kpiName.includes('target') || kpiName.includes('po')) {
          const dropPct = (((prevMonth - value) / prevMonth) * 100).toFixed(1)
          tryFlag('mom_drop_50', `MoM drop of ${dropPct}% on a revenue/sales KPI.`)
        }
      }
    }

    if (flagsToInsert.length > 0) {
      const { data: inserted } = await supabase
        .from('anomalies')
        .insert(flagsToInsert)
        .select('id, sub_metric_id, anomaly_type, description')
      for (const row of inserted || []) {
        detected.push({ id: row.id as number, sub_metric_id: row.sub_metric_id as number, type: row.anomaly_type as string, description: row.description as string })
      }
    }
  } catch (err) {
    console.error('Anomaly detection error:', err)
  }

  return detected
}
