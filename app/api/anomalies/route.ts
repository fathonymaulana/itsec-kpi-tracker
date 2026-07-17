import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// GET /api/anomalies?dept_id=&year=&month=
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const dept_id = searchParams.get('dept_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  const supabase = supabaseServer()

  // Small dataset (dozens of KPIs/sub-metrics) — cache the join keys in memory rather than fighting
  // PostgREST's nested-filter syntax for a 3-table join.
  const { data: kpis } = await supabase.from('kpis').select('id, kpi_name, dept_id')
  const { data: subMetrics } = await supabase.from('sub_metrics').select('id, kpi_id')
  const { data: departments } = await supabase.from('departments').select('id, name')
  const kpiById = new Map((kpis || []).map(k => [k.id, k]))
  const smById = new Map((subMetrics || []).map(sm => [sm.id, sm]))
  const deptNameById = new Map((departments || []).map(d => [d.id, d.name]))

  function enrich(a: Record<string, unknown>) {
    const sm = smById.get(a.sub_metric_id as number)
    const kpi = sm ? kpiById.get(sm.kpi_id) : null
    return {
      id: a.id,
      sub_metric_id: a.sub_metric_id,
      year: a.year,
      month: a.month,
      type: a.anomaly_type,
      description: a.description,
      created_at: a.detected_at,
      dismissed: a.dismissed,
      kpi_id: kpi?.id ?? null,
      kpi_name: kpi?.kpi_name ?? null,
      dept_id: kpi?.dept_id ?? null,
      department_name: kpi ? deptNameById.get(kpi.dept_id) ?? null : null,
    }
  }

  let rows
  if (dept_id && year && month) {
    const kpiIds = (kpis || []).filter(k => k.dept_id === dept_id).map(k => k.id)
    const smIds = (subMetrics || []).filter(sm => kpiIds.includes(sm.kpi_id)).map(sm => sm.id)
    const { data } = await supabase
      .from('anomalies').select('*')
      .in('sub_metric_id', smIds.length ? smIds : [-1])
      .eq('year', year).eq('month', month)
      .order('detected_at', { ascending: false })
    rows = data
  } else if (dept_id) {
    const kpiIds = (kpis || []).filter(k => k.dept_id === dept_id).map(k => k.id)
    const smIds = (subMetrics || []).filter(sm => kpiIds.includes(sm.kpi_id)).map(sm => sm.id)
    const { data } = await supabase
      .from('anomalies').select('*')
      .in('sub_metric_id', smIds.length ? smIds : [-1])
      .eq('dismissed', false)
      .order('detected_at', { ascending: false })
    rows = data
  } else {
    const { data } = await supabase
      .from('anomalies').select('*')
      .eq('dismissed', false)
      .order('detected_at', { ascending: false })
    rows = data
  }

  return NextResponse.json({ anomalies: (rows || []).map(enrich) })
}
