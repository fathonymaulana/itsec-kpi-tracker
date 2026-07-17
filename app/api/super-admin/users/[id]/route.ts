import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// PATCH /api/super-admin/users/:id — body: { name?, role?, dept_id?, active?, new_pin? }
// new_pin is a direct admin override — it bypasses the pending-request/approval flow entirely
// (that flow is for self-service changes via /api/users/me/pin-request).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request, ['corp_planning'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { name, role, dept_id, active, new_pin } = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (typeof name === 'string' && name.trim()) patch.name = name.trim()
  if (typeof role === 'string') {
    if (!['dept_head', 'corp_planning'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    patch.role = role
    patch.dept_id = role === 'dept_head' ? (dept_id ?? null) : null
  } else if (dept_id !== undefined) {
    patch.dept_id = dept_id
  }
  if (typeof active === 'boolean') patch.active = active
  if (new_pin !== undefined) {
    if (!/^\d{4}$/.test(new_pin)) return NextResponse.json({ error: 'new_pin must be exactly 4 digits' }, { status: 400 })
    patch.pin_hash = bcrypt.hashSync(new_pin, 10)
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const supabase = supabaseServer()

  // Corporate Planning now also manages user accounts, so it's possible to deactivate or demote the
  // only person left who can manage users — guard against that self-lockout.
  const losesCorpPlanningAccess = (patch.active === false) || (patch.role && patch.role !== 'corp_planning')
  if (losesCorpPlanningAccess) {
    const { data: target } = await supabase.from('users').select('role').eq('id', id).maybeSingle()
    if (target?.role === 'corp_planning') {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'corp_planning')
        .eq('active', true)
        .neq('id', id)
      if (!count) {
        return NextResponse.json({ error: 'Can’t remove the last Corporate Planning account — add another one first.' }, { status: 400 })
      }
    }
  }

  const { error } = await supabase.from('users').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
