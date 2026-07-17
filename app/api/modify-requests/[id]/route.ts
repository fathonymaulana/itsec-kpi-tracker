import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// PATCH /api/modify-requests/:id — body: { action: 'approve' | 'reject', note? }
// Approving deletes the submissions row for that dept/year/month, unlocking the whole month for
// re-editing (this app has no per-KPI lock — submission is all-or-nothing for the period).
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

  if (action === 'approve') {
    const { error: unlockError } = await supabase
      .from('submissions')
      .delete()
      .eq('dept_id', reqRow.dept_id).eq('year', reqRow.year).eq('month', reqRow.month)
    if (unlockError) return NextResponse.json({ error: unlockError.message }, { status: 500 })
  }

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
