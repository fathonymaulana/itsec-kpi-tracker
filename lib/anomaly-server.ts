import 'server-only'
import { supabaseServer } from './supabase-server'

interface DetectedAnomaly {
  id: number
  type: string
  description: string
}

export async function detectAnomalies(sub_metric_id: number, year: number, month: number): Promise<DetectedAnomaly[]> {
  const supabase = supabaseServer()
  const detected: DetectedAnomaly[] = []

  try {
    const { data: current } = await supabase
      .from('actuals')
      .select('value')
      .eq('sub_metric_id', sub_metric_id).eq('year', year).eq('month', month)
      .maybeSingle()
    if (!current || current.value === null || current.value === undefined) return detected

    const val = Number(current.value)

    const { data: prev3 } = await supabase
      .from('actuals')
      .select('value')
      .eq('sub_metric_id', sub_metric_id).eq('year', year).lt('month', month)
      .not('value', 'is', null)
      .order('month', { ascending: false })
      .limit(3)
    const prevRows = (prev3 || []) as { value: number }[]
    const prevMonth = prevRows.length > 0 ? Number(prevRows[0].value) : null

    const flag = async (type: string, desc: string) => {
      const { data: exists } = await supabase
        .from('anomalies')
        .select('id')
        .eq('sub_metric_id', sub_metric_id).eq('year', year).eq('month', month)
        .eq('anomaly_type', type).eq('dismissed', false)
        .maybeSingle()
      if (!exists) {
        const { data: inserted } = await supabase
          .from('anomalies')
          .insert({ sub_metric_id, year, month, anomaly_type: type, description: desc })
          .select('id')
          .single()
        if (inserted) detected.push({ id: inserted.id as number, type, description: desc })
      }
    }

    const validPrev = prevRows.map(r => Number(r.value)).filter(v => v !== null && v !== undefined)

    // 1. Spike: > 3x avg of prev 3 months
    if (validPrev.length >= 2) {
      const avg = validPrev.reduce((a, b) => a + b, 0) / validPrev.length
      if (avg > 0 && val > avg * 3) {
        await flag('spike', `Value ${val.toLocaleString()} is more than 3× the previous ${validPrev.length}-month average (${avg.toFixed(2)}).`)
      }
    }

    // 2. Drop: < 25% of previous month
    if (prevMonth !== null && prevMonth > 0 && val < prevMonth * 0.25) {
      await flag('drop', `Value ${val.toLocaleString()} is less than 25% of previous month value (${prevMonth.toLocaleString()}).`)
    }

    // 3. Zero after consecutive non-zero data
    if (val === 0 && validPrev.filter(v => v > 0).length >= 2) {
      await flag('zero_after_data', `Value is 0 after ${validPrev.filter(v => v > 0).length} consecutive months of non-zero data.`)
    }

    // 4. Impossible value: rate entered as whole number, or negative count
    const { data: sm } = await supabase.from('sub_metrics').select('name, is_calc').eq('id', sub_metric_id).maybeSingle()
    if (sm && !sm.is_calc) {
      const nameLower = String(sm.name).toLowerCase()
      if ((nameLower.includes('%') || nameLower.includes('rate') || nameLower.includes('ratio')) && val > 1.5) {
        await flag('impossible_value', `Rate/ratio value ${val} exceeds 150% — likely entered as a whole number (enter 0.85 not 85).`)
      }
      if ((nameLower.includes('no.') || nameLower.startsWith('(') || nameLower.includes('number')) && val < 0) {
        await flag('impossible_value', `Count value ${val} is negative — please check data entry.`)
      }
    }

    // 5. MoM drop > 50% on revenue/sales KPIs
    if (prevMonth !== null && prevMonth > 0 && val < prevMonth * 0.5) {
      const { data: smRow } = await supabase.from('sub_metrics').select('kpi_id').eq('id', sub_metric_id).maybeSingle()
      if (smRow) {
        const { data: kpi } = await supabase.from('kpis').select('kpi_name').eq('id', smRow.kpi_id).maybeSingle()
        const kpiName = String(kpi?.kpi_name || '').toLowerCase()
        if (kpiName.includes('revenue') || kpiName.includes('sales') || kpiName.includes('target') || kpiName.includes('po')) {
          const dropPct = (((prevMonth - val) / prevMonth) * 100).toFixed(1)
          await flag('mom_drop_50', `MoM drop of ${dropPct}% on a revenue/sales KPI.`)
        }
      }
    }
  } catch (err) {
    console.error('Anomaly detection error for sub_metric_id=' + sub_metric_id + ':', err)
  }

  return detected
}
