import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

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

  const kpis = []
  for (const kpi of rawKpis || []) {
    const { data: subMetrics } = await supabase
      .from('sub_metrics')
      .select('id, name, is_calc, formula_key, calc_input_positions, unit, display_order, numeric_target, direction')
      .eq('kpi_id', kpi.id)
      .order('display_order')
    kpis.push({
      id: kpi.id,
      dept_id: kpi.dept_id,
      name: kpi.kpi_name,
      target_text: kpi.target_text,
      numeric_target: kpi.numeric_target,
      direction: kpi.direction,
      frequency: kpi.frequency,
      sub_metrics: (subMetrics || []).map(sm => ({
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
    })
  }

  return NextResponse.json({ kpis })
}
