import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// GET /api/super-admin/users — list every user
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['super_admin'])
  if (auth instanceof NextResponse) return auth

  const supabase = supabaseServer()
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, avatar_url, role, dept_id, active, created_at, departments(name)')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    users: (users || []).map(u => ({
      ...u,
      dept_name: (u.departments as unknown as { name: string } | null)?.name ?? null,
      departments: undefined,
    })),
  })
}

// POST /api/super-admin/users — body: { name, role, dept_id?, pin }
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['super_admin'])
  if (auth instanceof NextResponse) return auth

  const { name, role, dept_id, pin } = await request.json().catch(() => ({}))
  if (!name?.trim() || !role || !pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: 'name, role, and a 4-digit pin are required' }, { status: 400 })
  }
  if (!['dept_head', 'corp_planning', 'super_admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }
  if (role === 'dept_head' && !dept_id) {
    return NextResponse.json({ error: 'dept_id is required for dept_head users' }, { status: 400 })
  }

  const supabase = supabaseServer()
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      name: name.trim(),
      role,
      dept_id: role === 'dept_head' ? dept_id : null,
      pin_hash: bcrypt.hashSync(pin, 10),
    })
    .select('id, name, role, dept_id, active')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ user })
}
