import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ actual_id: string }> }) {
  const auth = requireAuth(request, ['dept_head', 'corp_planning'])
  if (auth instanceof NextResponse) return auth
  const { actual_id } = await params

  const { data_source_url, data_source_note } = await request.json().catch(() => ({}))
  const supabase = supabaseServer()

  // Nothing previously verified this actual_id belongs to the caller's own department — a
  // dept_head could patch any department's data-source note/URL just by guessing the id.
  if (auth.role === 'dept_head') {
    const { data: actualRow } = await supabase.from('actuals').select('sub_metric_id').eq('id', actual_id).maybeSingle()
    const { data: smRow } = actualRow
      ? await supabase.from('sub_metrics').select('kpi_id').eq('id', actualRow.sub_metric_id).maybeSingle()
      : { data: null }
    const { data: kpiRow } = smRow
      ? await supabase.from('kpis').select('dept_id').eq('id', smRow.kpi_id).maybeSingle()
      : { data: null }
    if (!kpiRow || kpiRow.dept_id !== auth.dept_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabase
    .from('actuals')
    .update({
      data_source_url: data_source_url || null,
      data_source_note: data_source_note || null,
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', actual_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
