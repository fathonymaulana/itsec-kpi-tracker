import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'
import { getStatus, type KpiStatus } from '@/lib/status'
import { resolvePrimaryValue, type SubMetricLike } from '@/lib/kpi-primary'

interface KpiWithSubMetrics {
  id: number
  numeric_target: number | null
  direction: number
  sub_metrics: SubMetricLike[]
}

// Worst-first: a single department/month cell shows the most urgent status among its KPIs, falling back
// to the best available signal when nothing is urgent.
const SEVERITY: KpiStatus[] = ['off_track', 'watch', 'on_track', 'review_manually', 'no_data']
function worstStatus(statuses: KpiStatus[]): KpiStatus | undefined {
  for (const s of SEVERITY) if (statuses.includes(s)) return s
  return undefined
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ year: string }> }) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { year } = await params
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')

  const supabase = supabaseServer()
  const { data: depts } = await supabase.from('departments').select('id, name').order('name')

  const departments = []
  for (const dept of depts || []) {
    const { data: kpiRows } = await supabase.from('kpis').select('id, numeric_target, direction').eq('dept_id', dept.id)
    const kpiIds = (kpiRows || []).map(k => k.id)

    const { data: smRows } = kpiIds.length
      ? await supabase
          .from('sub_metrics')
          .select('id, kpi_id, is_calc, formula_key, calc_input_positions, numeric_target, direction, display_order')
          .in('kpi_id', kpiIds)
          .order('display_order')
      : { data: [] }
    const smIds = (smRows || []).map(sm => sm.id)

    const { data: yearActuals } = smIds.length
      ? await supabase.from('actuals').select('sub_metric_id, month, value').in('sub_metric_id', smIds).eq('year', year)
      : { data: [] }

    const kpis: KpiWithSubMetrics[] = (kpiRows || []).map(k => ({
      id: k.id,
      numeric_target: k.numeric_target,
      direction: k.direction,
      sub_metrics: (smRows || [])
        .filter(sm => sm.kpi_id === k.id)
        .map(sm => ({ ...sm, is_calculated: !!sm.is_calc })),
    }))

    const statusForMonth = (kpi: KpiWithSubMetrics, m: number): KpiStatus => {
      const valuesBySmId: Record<number, number> = {}
      for (const a of yearActuals || []) {
        if (a.month === m && a.value !== null && kpi.sub_metrics.some(sm => sm.id === a.sub_metric_id)) {
          valuesBySmId[a.sub_metric_id] = Number(a.value)
        }
      }
      const primary = kpi.sub_metrics.find(sm => sm.is_calculated) ?? kpi.sub_metrics[0]
      const value = resolvePrimaryValue(kpi.sub_metrics, valuesBySmId)
      const target = primary?.numeric_target ?? null
      const direction = primary?.direction ?? 1
      return getStatus(value, target, direction)
    }

    const { count: submittedCountForMonth } = month
      ? await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('dept_id', dept.id).eq('year', year).eq('month', month)
      : { count: 0 }
    const submitted = !!month && (submittedCountForMonth ?? 0) > 0

    const { count: anomalyCount } = smIds.length
      ? await supabase.from('anomalies').select('*', { count: 'exact', head: true }).in('sub_metric_id', smIds).eq('dismissed', false)
      : { count: 0 }

    const month_statuses: Partial<Record<number, KpiStatus>> = {}
    for (let m = 1; m <= 12; m++) {
      const hasAnyActual = (yearActuals || []).some(a => a.month === m && a.value !== null)
      if (!hasAnyActual) continue
      const statuses = kpis.map(k => statusForMonth(k, m))
      const worst = worstStatus(statuses)
      if (worst) month_statuses[m] = worst
    }

    let on_track = 0, watch = 0, off_track = 0, no_data = 0, review_manually = 0
    if (month) {
      for (const kpi of kpis) {
        const status = statusForMonth(kpi, parseInt(month, 10))
        if (status === 'on_track') on_track++
        else if (status === 'watch') watch++
        else if (status === 'off_track') off_track++
        else if (status === 'review_manually') review_manually++
        else no_data++
      }
    } else {
      no_data = kpis.length
    }

    departments.push({
      dept_id: dept.id,
      department_name: dept.name,
      total: kpis.length,
      on_track, watch, off_track, no_data, review_manually,
      submitted,
      anomaly_count: anomalyCount ?? 0,
      month_statuses,
    })
  }

  return NextResponse.json({ departments })
}
