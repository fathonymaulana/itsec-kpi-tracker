import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'
import { getStatus, type KpiStatus } from '@/lib/status'
import { resolvePrimaryValue, type SubMetricLike } from '@/lib/kpi-primary'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

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
  const deptIds = (depts || []).map(d => d.id)
  if (deptIds.length === 0) return NextResponse.json({ departments: [] })

  // Fetch every department's data in a fixed, small number of batched queries instead of
  // looping per department (which used to run 5 sequential queries per department — 40+
  // round-trips for an 8-department org on every dashboard load).
  const { data: allKpis } = await supabase.from('kpis').select('id, dept_id, numeric_target, direction').in('dept_id', deptIds)
  const kpiIds = (allKpis || []).map(k => k.id)

  const [{ data: allSubMetrics }, { data: allSubmissions }] = await Promise.all([
    kpiIds.length
      ? supabase
          .from('sub_metrics')
          .select('id, kpi_id, is_calc, formula_key, calc_input_positions, numeric_target, direction, display_order')
          .in('kpi_id', kpiIds)
          .order('display_order')
      : Promise.resolve({ data: [] as { id: number; kpi_id: number; is_calc: boolean; formula_key: string | null; calc_input_positions: string | null; numeric_target: number | null; direction: number; display_order: number }[] }),
    month
      ? supabase.from('submissions').select('dept_id').eq('year', year).eq('month', month).in('dept_id', deptIds)
      : Promise.resolve({ data: [] as { dept_id: string }[] }),
  ])
  const smIds = (allSubMetrics || []).map(sm => sm.id)

  const [{ data: allActuals }, { data: allAnomalies }] = await Promise.all([
    smIds.length
      ? supabase.from('actuals').select('sub_metric_id, month, value').in('sub_metric_id', smIds).eq('year', year)
      : Promise.resolve({ data: [] as { sub_metric_id: number; month: number; value: number | null }[] }),
    smIds.length
      ? supabase.from('anomalies').select('sub_metric_id').in('sub_metric_id', smIds).eq('dismissed', false)
      : Promise.resolve({ data: [] as { sub_metric_id: number }[] }),
  ])

  const kpisByDept = new Map<string, typeof allKpis>()
  for (const k of allKpis || []) {
    if (!kpisByDept.has(k.dept_id)) kpisByDept.set(k.dept_id, [])
    kpisByDept.get(k.dept_id)!.push(k)
  }
  const smByKpi = new Map<number, typeof allSubMetrics>()
  for (const sm of allSubMetrics || []) {
    if (!smByKpi.has(sm.kpi_id)) smByKpi.set(sm.kpi_id, [])
    smByKpi.get(sm.kpi_id)!.push(sm)
  }
  const actualsBySm = new Map<number, { month: number; value: number | null }[]>()
  for (const a of allActuals || []) {
    if (!actualsBySm.has(a.sub_metric_id)) actualsBySm.set(a.sub_metric_id, [])
    actualsBySm.get(a.sub_metric_id)!.push({ month: a.month, value: a.value })
  }
  const submittedDeptSet = new Set((allSubmissions || []).map(s => s.dept_id))
  const anomalyCountBySm = new Map<number, number>()
  for (const a of allAnomalies || []) {
    anomalyCountBySm.set(a.sub_metric_id, (anomalyCountBySm.get(a.sub_metric_id) || 0) + 1)
  }

  const departments = (depts || []).map(dept => {
    const kpiRows = kpisByDept.get(dept.id) || []
    const kpis: KpiWithSubMetrics[] = kpiRows.map(k => ({
      id: k.id,
      numeric_target: k.numeric_target,
      direction: k.direction,
      sub_metrics: (smByKpi.get(k.id) || []).map(sm => ({ ...sm, is_calculated: !!sm.is_calc })),
    }))
    const smIdsForDept = kpis.flatMap(k => k.sub_metrics.map(sm => sm.id))

    const statusForMonth = (kpi: KpiWithSubMetrics, m: number): KpiStatus => {
      const valuesBySmId: Record<number, number> = {}
      for (const sm of kpi.sub_metrics) {
        const row = (actualsBySm.get(sm.id) || []).find(r => r.month === m)
        if (row && row.value !== null) valuesBySmId[sm.id] = Number(row.value)
      }
      const primary = kpi.sub_metrics.find(sm => sm.is_calculated) ?? kpi.sub_metrics[0]
      const value = resolvePrimaryValue(kpi.sub_metrics, valuesBySmId)
      const target = primary?.numeric_target ?? null
      const direction = primary?.direction ?? 1
      return getStatus(value, target, direction)
    }

    const month_statuses: Partial<Record<number, KpiStatus>> = {}
    for (let m = 1; m <= 12; m++) {
      const hasAnyActual = smIdsForDept.some(smId => (actualsBySm.get(smId) || []).some(r => r.month === m && r.value !== null))
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

    const anomaly_count = smIdsForDept.reduce((sum, id) => sum + (anomalyCountBySm.get(id) || 0), 0)

    return {
      dept_id: dept.id,
      department_name: dept.name,
      total: kpis.length,
      on_track, watch, off_track, no_data, review_manually,
      submitted: !!month && submittedDeptSet.has(dept.id),
      anomaly_count,
      month_statuses,
    }
  })

  return NextResponse.json({ departments })
}
