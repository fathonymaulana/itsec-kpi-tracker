import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// GET /api/users/me — own profile + any pending PIN-change request
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const supabase = supabaseServer()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, avatar_url, role, dept_id, departments(name)')
    .eq('id', auth.user_id)
    .maybeSingle()
  if (error || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: pendingRequest } = await supabase
    .from('pin_change_requests')
    .select('id, status, requested_at')
    .eq('user_id', auth.user_id)
    .eq('status', 'pending')
    .maybeSingle()

  return NextResponse.json({
    id: user.id,
    name: user.name,
    avatar_url: user.avatar_url,
    role: user.role,
    dept_id: user.dept_id,
    dept_name: (user.departments as unknown as { name: string } | null)?.name ?? null,
    pending_pin_request: pendingRequest ?? null,
  })
}

// PATCH /api/users/me — body: { name?, avatar_url? }
export async function PATCH(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { name, avatar_url } = await request.json().catch(() => ({}))
  const patch: Record<string, string> = {}
  if (typeof name === 'string' && name.trim()) patch.name = name.trim()
  if (typeof avatar_url === 'string') patch.avatar_url = avatar_url
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const supabase = supabaseServer()
  const { error } = await supabase.from('users').update(patch).eq('id', auth.user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
