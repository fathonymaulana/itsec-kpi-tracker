import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// GET /api/board/anomalies?year=&month=
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  const supabase = supabaseServer()
  const { data: kpis } = await supabase.from('kpis').select('id, kpi_name, dept_id')
  const { data: subMetrics } = await supabase.from('sub_metrics').select('id, kpi_id')
  const { data: departments } = await supabase.from('departments').select('id, name')
  const kpiById = new Map((kpis || []).map(k => [k.id, k]))
  const smById = new Map((subMetrics || []).map(sm => [sm.id, sm]))
  const deptNameById = new Map((departments || []).map(d => [d.id, d.name]))

  let query = supabase.from('anomalies').select('*').eq('dismissed', false).order('detected_at', { ascending: false })
  if (year && month) query = query.eq('year', year).eq('month', month)
  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const anomalies = (rows || []).map(a => {
    const sm = smById.get(a.sub_metric_id)
    const kpi = sm ? kpiById.get(sm.kpi_id) : null
    return {
      id: a.id,
      type: a.anomaly_type,
      description: a.description,
      created_at: a.detected_at,
      dismissed: a.dismissed,
      kpi_name: kpi?.kpi_name ?? null,
      dept_id: kpi?.dept_id ?? null,
      department_name: kpi ? deptNameById.get(kpi.dept_id) ?? null : null,
    }
  })
  return NextResponse.json({ anomalies })
}
