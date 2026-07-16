import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'
import { detectAnomalies } from '@/lib/anomaly-server'

// GET /api/actuals?dept_id=&year=&month= (month optional for full-year fetch)
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const dept_id = searchParams.get('dept_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  if (!dept_id || !year) return NextResponse.json({ error: 'dept_id and year required' }, { status: 400 })
  if (auth.role === 'dept_head' && auth.dept_id !== dept_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = supabaseServer()
  const { data: kpiRows } = await supabase.from('kpis').select('id').eq('dept_id', dept_id)
  const kpiIds = (kpiRows || []).map(k => k.id)
  if (kpiIds.length === 0) return NextResponse.json({ actuals: [] })

  const { data: smRows } = await supabase
    .from('sub_metrics')
    .select('id, kpi_id, name, is_calc, formula_key, display_order')
    .in('kpi_id', kpiIds)
  const smById = new Map((smRows || []).map(sm => [sm.id, sm]))
  const smIds = (smRows || []).map(sm => sm.id)
  if (smIds.length === 0) return NextResponse.json({ actuals: [] })

  let query = supabase
    .from('actuals')
    .select('id, sub_metric_id, year, month, value, data_source_url, data_source_note')
    .in('sub_metric_id', smIds)
    .eq('year', year)
  if (month) query = query.eq('month', month)
  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const actuals = (rows || [])
    .map(a => {
      const sm = smById.get(a.sub_metric_id)
      return {
        ...a,
        kpi_id: sm?.kpi_id ?? null,
        sm_name: sm?.name ?? null,
        is_calculated: sm?.is_calc ? 1 : 0,
        formula_key: sm?.formula_key ?? null,
      }
    })
    .sort((a, b) => (a.month - b.month) || ((smById.get(a.sub_metric_id)?.display_order ?? 0) - (smById.get(b.sub_metric_id)?.display_order ?? 0)))

  return NextResponse.json({ actuals })
}

// POST /api/actuals — body: { actuals: [{sub_metric_id, kpi_id, dept_id, year, month, value, data_source_url?, data_source_note?}] }
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['dept_head', 'corp_planning'])
  if (auth instanceof NextResponse) return auth

  const { actuals } = await request.json().catch(() => ({}))
  if (!Array.isArray(actuals) || actuals.length === 0) {
    return NextResponse.json({ error: 'actuals array required' }, { status: 400 })
  }

  const supabase = supabaseServer()
  const submittedBy = auth.dept_id || auth.role
  const newAnomalies = []

  try {
    for (const r of actuals) {
      const { data: existing } = await supabase
        .from('actuals')
        .select('data_source_url, data_source_note')
        .eq('sub_metric_id', r.sub_metric_id).eq('year', r.year).eq('month', r.month)
        .maybeSingle()

      const { error: upsertErr } = await supabase.from('actuals').upsert(
        {
          sub_metric_id: r.sub_metric_id,
          year: r.year,
          month: r.month,
          value: r.value ?? null,
          data_source_url: r.data_source_url || existing?.data_source_url || null,
          data_source_note: r.data_source_note || existing?.data_source_note || null,
          submitted_by: submittedBy,
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: 'sub_metric_id,year,month' }
      )
      if (upsertErr) throw upsertErr

      if (r.value !== null && r.value !== undefined) {
        const detected = await detectAnomalies(r.sub_metric_id, r.year, r.month)
        if (detected.length) newAnomalies.push(...detected)
      }
    }
    return NextResponse.json({ success: true, anomalies: newAnomalies })
  } catch (err) {
    console.error('Save actuals error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Save failed' }, { status: 500 })
  }
}
