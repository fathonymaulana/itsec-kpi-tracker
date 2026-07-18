import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// GET /api/verifications?dept_id=&year=&month= — dept_head callers are always scoped to their own
// dept_id regardless of the query string (so they can see verification/flag notifications for their
// own submissions), matching /api/modify-requests' pattern; corp_planning can query any department.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['corp_planning', 'dept_head'])
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const dept_id = auth.role === 'dept_head' ? auth.dept_id : searchParams.get('dept_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  if (!dept_id || !year || !month) return NextResponse.json({ error: 'dept_id, year, month required' }, { status: 400 })

  const supabase = supabaseServer()
  const { data: rows, error } = await supabase
    .from('verifications')
    .select('id, kpi_id, status, note, verified_at, kpis(kpi_name)')
    .eq('dept_id', dept_id).eq('year', year).eq('month', month)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const verifications = (rows || []).map(v => ({
    id: v.id,
    kpi_id: v.kpi_id,
    status: v.status,
    note: v.note,
    verified_at: v.verified_at,
    kpi_name: (v.kpis as unknown as { kpi_name: string } | null)?.kpi_name ?? null,
  }))
  return NextResponse.json({ verifications })
}

// POST /api/verifications — body: { kpi_id, dept_id, year, month, status, note }
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['corp_planning'])
  if (auth instanceof NextResponse) return auth

  const { kpi_id, dept_id, year, month, status, note } = await request.json().catch(() => ({}))
  if (!kpi_id || !dept_id || !year || !month || !status) {
    return NextResponse.json({ error: 'kpi_id, dept_id, year, month, status required' }, { status: 400 })
  }

  const supabase = supabaseServer()
  const { error } = await supabase.from('verifications').upsert(
    {
      kpi_id, dept_id, year, month,
      verified_by: 'corp_planning',
      status,
      note: note || null,
      verified_at: new Date().toISOString(),
    },
    { onConflict: 'kpi_id,dept_id,year,month' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
