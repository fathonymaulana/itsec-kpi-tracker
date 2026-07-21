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
  // Cross-department aggregates — the /board page itself already redirects dept_head away from
  // this view, but nothing at the API layer enforced that; a dept_head could otherwise call this
  // directly and see every other department's on-track/watch/off-track rollup.
  const auth = requireAuth(request, ['corp_planning'])
  if (auth instanceof NextResponse) return auth
  const { year: yearStr } = await params
  const fromYear = parseInt(yearStr, 10)
  const { searchParams } = new URL(request.url)
  // fromMonth/toMonth/toYear describe the selected range — CorPlan's sidebar picker always sends
  // all three now. Defaulting toYear to fromYear and both months to the same value keeps this
  // working as a plain single-month lookup when only fromMonth is actually different from toMonth.
  const fromMonth = parseInt(searchParams.get('fromMonth') || '1', 10)
  const toYear = parseInt(searchParams.get('toYear') || String(fromYear), 10)
  const toMonth = parseInt(searchParams.get('toMonth') || String(fromMonth), 10)

  // Every {year, month} in the requested range, inclusive, in order — used to compute each KPI's
  // worst status across the whole range (not just one month), same "worst wins" convention already
  // used for month_statuses below.
  const periods: { year: number; month: number }[] = []
  {
    let y = fromYear, m = fromMonth
    while (y < toYear || (y === toYear && m <= toMonth)) {
      periods.push({ year: y, month: m })
      m++
      if (m > 12) { m = 1; y++ }
    }
  }
  const years = Array.from(new Set(periods.map(p => p.year)))

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
    // "Submitted" reflects the most recent period in the range — the range's own tail end.
    supabase.from('submissions').select('dept_id').eq('year', toYear).eq('month', toMonth).in('dept_id', deptIds),
  ])
  const smIds = (allSubMetrics || []).map(sm => sm.id)

  const { data: allActuals } = smIds.length
    ? await supabase.from('actuals').select('sub_metric_id, year, month, value').in('sub_metric_id', smIds).in('year', years)
    : { data: [] as { sub_metric_id: number; year: number; month: number; value: number | null }[] }

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
  const actualsBySm = new Map<number, { year: number; month: number; value: number | null }[]>()
  // year -> month -> smId -> value — kept per-year (not a flat month key) since a "≥4/year" target
  // still needs to sum within its own calendar year even when the selected range spans two years.
  const actualsByYearMonth: Record<number, Record<number, Record<number, number>>> = {}
  for (const a of allActuals || []) {
    if (!actualsBySm.has(a.sub_metric_id)) actualsBySm.set(a.sub_metric_id, [])
    actualsBySm.get(a.sub_metric_id)!.push({ year: a.year, month: a.month, value: a.value })
    if (a.value !== null) {
      if (!actualsByYearMonth[a.year]) actualsByYearMonth[a.year] = {}
      if (!actualsByYearMonth[a.year][a.month]) actualsByYearMonth[a.year][a.month] = {}
      actualsByYearMonth[a.year][a.month][a.sub_metric_id] = Number(a.value)
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
    const statusForPeriod = (kpi: KpiWithSubMetrics, year: number, m: number): KpiStatus => {
      const actualsByMonth = actualsByYearMonth[year] || {}
      const { overall } = getPeriodStatuses(kpi.sub_metrics, actualsByMonth, kpi.frequency, m)
      if (overall) return overall
      const primary = kpi.sub_metrics.find(sm => sm.is_calculated) ?? kpi.sub_metrics[0]
      const value = resolvePrimaryValue(kpi.sub_metrics, actualsByMonth[m] || {})
      const target = primary?.numeric_target ?? null
      const direction = primary?.direction ?? 1
      return getStatus(value, target, direction)
    }

    // Unchanged from before: still a plain whole-year (fromYear only) month-by-month breakdown, used
    // by the separate per-year fetch that powers the Table tab's full-year breakdown — the range
    // selected in the sidebar doesn't affect this.
    const month_statuses: Partial<Record<number, KpiStatus>> = {}
    for (let m = 1; m <= 12; m++) {
      const hasAnyActual = smIdsForDept.some(smId => (actualsBySm.get(smId) || []).some(r => r.year === fromYear && r.month === m && r.value !== null))
      if (!hasAnyActual) continue
      const statuses = kpis.map(k => statusForPeriod(k, fromYear, m))
      const worst = worstStatus(statuses)
      if (worst) month_statuses[m] = worst
    }

    // Range-aggregated tally — each KPI counts once, as its single worst status across every period
    // in the selected range (matching month_statuses' own "worst wins" convention, just applied over
    // more than one month when the range spans more than a single month).
    let on_track = 0, watch = 0, off_track = 0, no_data = 0, review_manually = 0
    for (const kpi of kpis) {
      const statuses = periods.map(p => statusForPeriod(kpi, p.year, p.month))
      const status = worstStatus(statuses)
      if (status === 'on_track') on_track++
      else if (status === 'watch') watch++
      else if (status === 'off_track') off_track++
      else if (status === 'review_manually') review_manually++
      else no_data++
    }

    // Same tally, but kept separate per period instead of collapsed to one worst-wins value — lets
    // the client offer per-month tabs under a multi-month range without a separate fetch per tab.
    const periodTallies = periods.map(p => {
      let pOnTrack = 0, pWatch = 0, pOffTrack = 0, pNoData = 0, pReviewManually = 0
      for (const kpi of kpis) {
        const status = statusForPeriod(kpi, p.year, p.month)
        if (status === 'on_track') pOnTrack++
        else if (status === 'watch') pWatch++
        else if (status === 'off_track') pOffTrack++
        else if (status === 'review_manually') pReviewManually++
        else pNoData++
      }
      return { year: p.year, month: p.month, on_track: pOnTrack, watch: pWatch, off_track: pOffTrack, no_data: pNoData, review_manually: pReviewManually }
    })

    return {
      dept_id: dept.id,
      department_name: dept.name,
      total: kpis.length,
      on_track, watch, off_track, no_data, review_manually,
      submitted: submittedDeptSet.has(dept.id),
      month_statuses,
      periods: periodTallies,
    }
  })

  return NextResponse.json({ departments })
}
