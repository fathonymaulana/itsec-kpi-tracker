import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (auth.role === 'dept_head' && auth.dept_id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = supabaseServer()
  const { data: rawKpis, error } = await supabase.from('kpis').select('*').eq('dept_id', id).order('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  interface SubMetricRow {
    id: number; kpi_id: number; name: string; is_calc: boolean; formula_key: string | null
    calc_input_positions: string | null; unit: string; display_order: number
    numeric_target: number | null; direction: number
  }

  const kpiIds = (rawKpis || []).map(k => k.id)
  const { data: allSubMetrics } = kpiIds.length
    ? await supabase
        .from('sub_metrics')
        .select('id, kpi_id, name, is_calc, formula_key, calc_input_positions, unit, display_order, numeric_target, direction')
        .in('kpi_id', kpiIds)
        .order('display_order')
    : { data: [] as SubMetricRow[] }

  const smByKpi = new Map<number, SubMetricRow[]>()
  for (const sm of allSubMetrics || []) {
    if (!smByKpi.has(sm.kpi_id)) smByKpi.set(sm.kpi_id, [])
    smByKpi.get(sm.kpi_id)!.push(sm)
  }

  const kpis = (rawKpis || []).map(kpi => ({
    id: kpi.id,
    dept_id: kpi.dept_id,
    name: kpi.kpi_name,
    target_text: kpi.target_text,
    numeric_target: kpi.numeric_target,
    direction: kpi.direction,
    frequency: kpi.frequency,
    sub_metrics: (smByKpi.get(kpi.id) || []).map(sm => ({
      id: sm.id,
      name: sm.name,
      is_calculated: sm.is_calc ? 1 : 0,
      formula_key: sm.formula_key,
      calc_input_positions: sm.calc_input_positions,
      unit: sm.unit,
      display_order: sm.display_order,
      numeric_target: sm.numeric_target,
      direction: sm.direction,
    })),
  }))

  return NextResponse.json({ kpis })
}
