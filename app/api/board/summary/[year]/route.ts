import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'
import { getStatus, worstStatus, type KpiStatus } from '@/lib/status'
import { resolvePrimaryValue, getPeriodStatuses, type SubMetricLike } from '@/lib/kpi-primary'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

interface KpiWithSubMetrics {
  id: number
  numeric_target: number | null
  direction: number
  frequency: string | null
  sub_metrics: SubMetricLike[]
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
  const { data: allKpis } = await supabase.from('kpis').select('id, dept_id, numeric_target, direction, frequency').in('dept_id', deptIds)
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

  const { data: allActuals } = smIds.length
    ? await supabase.from('actuals').select('sub_metric_id, month, value').in('sub_metric_id', smIds).eq('year', year)
    : { data: [] as { sub_metric_id: number; month: number; value: number | null }[] }

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
  const actualsByMonth: Record<number, Record<number, number>> = {} // month -> smId -> value, all depts
  for (const a of allActuals || []) {
    if (!actualsBySm.has(a.sub_metric_id)) actualsBySm.set(a.sub_metric_id, [])
    actualsBySm.get(a.sub_metric_id)!.push({ month: a.month, value: a.value })
    if (a.value !== null) {
      if (!actualsByMonth[a.month]) actualsByMonth[a.month] = {}
      actualsByMonth[a.month][a.sub_metric_id] = Number(a.value)
    }
  }
  const submittedDeptSet = new Set((allSubmissions || []).map(s => s.dept_id))

  const departments = (depts || []).map(dept => {
    const kpiRows = kpisByDept.get(dept.id) || []
    const kpis: KpiWithSubMetrics[] = kpiRows.map(k => ({
      id: k.id,
      numeric_target: k.numeric_target,
      direction: k.direction,
      frequency: k.frequency,
      sub_metrics: (smByKpi.get(k.id) || []).map(sm => ({ ...sm, is_calculated: !!sm.is_calc })),
    }))
    const smIdsForDept = kpis.flatMap(k => k.sub_metrics.map(sm => sm.id))

    // Worst status among every sub-metric that carries its own target, evaluated over the KPI's own
    // reporting period (see lib/frequency.ts) — a "≥4/year" target is judged against the year's
    // running total, not a single month's raw entry, so an early-year monthly value of 1 doesn't
    // wrongly flag off track.
    const statusForMonth = (kpi: KpiWithSubMetrics, m: number): KpiStatus => {
      const { overall } = getPeriodStatuses(kpi.sub_metrics, actualsByMonth, kpi.frequency, m)
      if (overall) return overall
      const primary = kpi.sub_metrics.find(sm => sm.is_calculated) ?? kpi.sub_metrics[0]
      const value = resolvePrimaryValue(kpi.sub_metrics, actualsByMonth[m] || {})
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

    return {
      dept_id: dept.id,
      department_name: dept.name,
      total: kpis.length,
      on_track, watch, off_track, no_data, review_manually,
      submitted: !!month && submittedDeptSet.has(dept.id),
      month_statuses,
    }
  })

  return NextResponse.json({ departments })
}
