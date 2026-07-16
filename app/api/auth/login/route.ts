import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServer } from '@/lib/supabase-server'
import { signToken } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  const { dept_id, pin } = await request.json().catch(() => ({}))
  if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  const supabase = supabaseServer()

  // Try dept login first
  if (dept_id && !String(dept_id).startsWith('__')) {
    const { data: dept } = await supabase.from('departments').select('*').eq('id', dept_id).maybeSingle()
    if (dept && bcrypt.compareSync(pin, dept.pin_hash as string)) {
      const token = signToken({ role: 'dept_head', dept_id: dept.id as string })
      return NextResponse.json({ token, role: 'dept_head', dept_id: dept.id, dept_name: dept.name })
    }
  }

  // Try role login (corp_planning / board)
  const { data: roles } = await supabase.from('roles').select('*')
  for (const role of roles || []) {
    if (bcrypt.compareSync(pin, role.pin_hash as string)) {
      const token = signToken({ role: role.role_key as 'corp_planning' | 'board', dept_id: null })
      return NextResponse.json({ token, role: role.role_key, dept_id: null, dept_name: role.display_name })
    }
  }

  return NextResponse.json({ error: 'Incorrect PIN. Please try again.' }, { status: 401 })
}
