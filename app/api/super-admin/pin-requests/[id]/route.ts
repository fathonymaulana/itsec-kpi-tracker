import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// PATCH /api/super-admin/pin-requests/:id — body: { action: 'approve' | 'reject', note? }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request, ['super_admin'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { action, note } = await request.json().catch(() => ({}))
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }

  const supabase = supabaseServer()
  const { data: reqRow, error: fetchError } = await supabase
    .from('pin_change_requests')
    .select('id, user_id, new_pin_hash, status')
    .eq('id', id)
    .maybeSingle()
  if (fetchError || !reqRow) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (reqRow.status !== 'pending') return NextResponse.json({ error: 'Request already reviewed' }, { status: 400 })

  if (action === 'approve') {
    const { error: pinError } = await supabase.from('users').update({ pin_hash: reqRow.new_pin_hash }).eq('id', reqRow.user_id)
    if (pinError) return NextResponse.json({ error: pinError.message }, { status: 500 })
  }

  const { error } = await supabase
    .from('pin_change_requests')
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
