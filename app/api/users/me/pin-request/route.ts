import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// POST /api/users/me/pin-request — body: { new_pin }
// Does NOT change the login PIN. Creates (or replaces) a pending request; the current PIN keeps
// working until a Super Admin approves it via /api/super-admin/pin-requests/[id].
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { new_pin } = await request.json().catch(() => ({}))
  if (!new_pin || !/^\d{4}$/.test(new_pin)) {
    return NextResponse.json({ error: 'new_pin must be exactly 4 digits' }, { status: 400 })
  }

  const supabase = supabaseServer()
  const { data: existing } = await supabase
    .from('pin_change_requests')
    .select('id')
    .eq('user_id', auth.user_id).eq('status', 'pending')
    .maybeSingle()

  const new_pin_hash = bcrypt.hashSync(new_pin, 10)

  if (existing) {
    const { error } = await supabase
      .from('pin_change_requests')
      .update({ new_pin_hash, requested_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from('pin_change_requests')
      .insert({ user_id: auth.user_id, new_pin_hash })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
