import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// GET /api/submissions?dept_id=&year=&month=&limit=
// dept_head is always scoped to their own dept_id. corp_planning can pass dept_id/year to filter the
// same as before, or omit both — that's the navbar notification bell asking "what's been submitted
// recently, across every department", newest first, capped by `limit` (defaults to 20).
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const dept_id = auth.role === 'dept_head' ? auth.dept_id : searchParams.get('dept_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const limitParam = searchParams.get('limit')

  const supabase = supabaseServer()
  let query = supabase
    .from('submissions')
    .select('id, dept_id, year, month, submitted_at, departments(name)')
    .order('submitted_at', { ascending: false })
  if (dept_id) query = query.eq('dept_id', dept_id)
  if (year) query = query.eq('year', year)
  if (month) query = query.eq('month', month)
  if (limitParam) query = query.limit(parseInt(limitParam, 10))

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const submissions = (rows || []).map(r => ({
    id: r.id,
    dept_id: r.dept_id,
    year: r.year,
    month: r.month,
    submitted_at: r.submitted_at,
    dept_name: (r.departments as unknown as { name: string } | null)?.name ?? null,
  }))
  return NextResponse.json({ submissions })
}

// POST /api/submissions — body: { dept_id, year, month }
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['dept_head', 'corp_planning'])
  if (auth instanceof NextResponse) return auth

  const { dept_id, year, month } = await request.json().catch(() => ({}))
  if (auth.role === 'dept_head' && auth.dept_id !== dept_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = supabaseServer()
  const { error } = await supabase.from('submissions').upsert(
    { dept_id, year, month },
    { onConflict: 'dept_id,year,month', ignoreDuplicates: true }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-submitting closes out any approved modify request whose KPI was ACTUALLY re-entered since
  // approval — not every approved request open for this dept/period. The Data Entry page has one
  // Submit button for the whole month, so if two different KPIs both happen to have an approved
  // modify request open at once, submitting after fixing only one of them must not silently re-lock
  // the other before the dept_head ever got to it. actuals.last_updated_at only advances when a
  // sub-metric's value genuinely changes (see /api/actuals' upsert), so comparing it against
  // reviewed_at reliably tells "was this specific KPI's data touched since approval" apart from
  // "the whole month got resubmitted."
  const { data: openApproved } = await supabase
    .from('modify_requests')
    .select('id, kpi_id, reviewed_at')
    .eq('dept_id', dept_id).eq('year', year).eq('month', month).eq('status', 'approved')

  if (openApproved && openApproved.length > 0) {
    const kpiIds = openApproved.map(r => r.kpi_id)
    const { data: smRows } = await supabase.from('sub_metrics').select('id, kpi_id').in('kpi_id', kpiIds)
    const smIds = (smRows || []).map(sm => sm.id)
    const { data: actualRows } = smIds.length
      ? await supabase.from('actuals').select('sub_metric_id, last_updated_at').in('sub_metric_id', smIds).eq('year', year).eq('month', month)
      : { data: [] as { sub_metric_id: number; last_updated_at: string }[] }

    const latestUpdateByKpi = new Map<number, string>()
    for (const sm of smRows || []) {
      const actual = (actualRows || []).find(a => a.sub_metric_id === sm.id)
      if (!actual) continue
      const prev = latestUpdateByKpi.get(sm.kpi_id)
      if (!prev || actual.last_updated_at > prev) latestUpdateByKpi.set(sm.kpi_id, actual.last_updated_at)
    }

    const resolvedIds = openApproved
      .filter(r => {
        const latest = latestUpdateByKpi.get(r.kpi_id)
        return !!latest && !!r.reviewed_at && latest > r.reviewed_at
      })
      .map(r => r.id)

    if (resolvedIds.length > 0) {
      await supabase.from('modify_requests').update({ status: 'resolved' }).in('id', resolvedIds)
    }
  }

  return NextResponse.json({ success: true })
}
