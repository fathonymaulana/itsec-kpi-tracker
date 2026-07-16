import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// GET /api/super-admin/pin-requests — all requests (pending first), with the requesting user's name
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['super_admin'])
  if (auth instanceof NextResponse) return auth

  const supabase = supabaseServer()
  const { data: requests, error } = await supabase
    .from('pin_change_requests')
    .select('id, status, requested_at, reviewed_at, review_note, users!pin_change_requests_user_id_fkey(id, name, role, dept_id)')
    .order('requested_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    requests: (requests || []).map(r => ({
      id: r.id,
      status: r.status,
      requested_at: r.requested_at,
      reviewed_at: r.reviewed_at,
      review_note: r.review_note,
      user: r.users,
    })),
  })
}
