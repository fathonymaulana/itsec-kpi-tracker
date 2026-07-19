import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// PATCH /api/modify-requests/:id — body: { action: 'approve' | 'reject', note? }
// Approving used to delete the whole month's submissions row, unlocking every KPI in the period for
// re-editing just to let the dept_head fix the one they actually asked about. It no longer touches
// submissions at all: the month stays "submitted", and only the specific requested KPI unlocks (see
// dept/page.tsx's per-KPI readOnly check, keyed off an 'approved' modify_requests row for that
// kpi_id). Re-submitting the month (POST /api/submissions) is what closes the loop, flipping this
// request to 'resolved' so the KPI locks again like everything else.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request, ['corp_planning'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { action, note } = await request.json().catch(() => ({}))
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }

  const supabase = supabaseServer()
  const { data: reqRow, error: fetchError } = await supabase
    .from('modify_requests')
    .select('id, dept_id, year, month, status')
    .eq('id', id)
    .maybeSingle()
  if (fetchError || !reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (reqRow.status !== 'pending') return NextResponse.json({ error: 'Request already reviewed' }, { status: 400 })

  const { error } = await supabase
    .from('modify_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: auth.user_id,
      review_note: note || null,
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
