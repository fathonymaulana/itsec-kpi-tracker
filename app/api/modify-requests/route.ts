import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// GET /api/modify-requests?dept_id=&year=&month=&status=
// dept_head callers are always scoped to their own dept_id, regardless of what's in the query string —
// corp_planning can pass dept_id to filter, or omit it to see requests across every department.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const status = searchParams.get('status')
  const deptId = auth.role === 'dept_head' ? auth.dept_id : searchParams.get('dept_id')

  const supabase = supabaseServer()
  let query = supabase
    .from('modify_requests')
    .select('id, kpi_id, dept_id, year, month, reason, status, requested_at, reviewed_at, review_note, kpis(kpi_name), departments(name), requested_by:users!modify_requests_requested_by_fkey(name)')
    .order('requested_at', { ascending: false })

  if (deptId) query = query.eq('dept_id', deptId)
  if (year) query = query.eq('year', year)
  if (month) query = query.eq('month', month)
  if (status) query = query.eq('status', status)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const requests = (rows || []).map(r => ({
    id: r.id,
    kpi_id: r.kpi_id,
    dept_id: r.dept_id,
    year: r.year,
    month: r.month,
    reason: r.reason,
    status: r.status,
    requested_at: r.requested_at,
    reviewed_at: r.reviewed_at,
    review_note: r.review_note,
    kpi_name: (r.kpis as unknown as { kpi_name: string } | null)?.kpi_name ?? null,
    dept_name: (r.departments as unknown as { name: string } | null)?.name ?? null,
    requested_by_name: (r.requested_by as unknown as { name: string } | null)?.name ?? null,
  }))
  return NextResponse.json({ requests })
}

// POST /api/modify-requests — body: { kpi_id, year, month, reason }
// dept_id and requested_by come from the caller's own token, never the request body.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['dept_head'])
  if (auth instanceof NextResponse) return auth
  if (!auth.dept_id) return NextResponse.json({ error: 'No department on this account' }, { status: 400 })

  const { kpi_id, year, month, reason } = await request.json().catch(() => ({}))
  if (!kpi_id || !year || !month || !reason?.trim()) {
    return NextResponse.json({ error: 'kpi_id, year, month, and reason are required' }, { status: 400 })
  }

  const supabase = supabaseServer()

  // Don't stack a second pending request for the same KPI/period.
  const { data: existing } = await supabase
    .from('modify_requests')
    .select('id')
    .eq('kpi_id', kpi_id).eq('dept_id', auth.dept_id).eq('year', year).eq('month', month).eq('status', 'pending')
    .maybeSingle()
  if (existing) return NextResponse.json({ error: 'A request for this KPI is already pending review' }, { status: 400 })

  const { data: reqRow, error } = await supabase
    .from('modify_requests')
    .insert({
      kpi_id, dept_id: auth.dept_id, year, month,
      reason: reason.trim(),
      requested_by: auth.user_id,
    })
    .select('id, status, requested_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ request: reqRow })
}
