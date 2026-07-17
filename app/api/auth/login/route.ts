import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseServer } from '@/lib/supabase-server'
import { signToken } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

export async function POST(request: NextRequest) {
  const { user_id, pin } = await request.json().catch(() => ({}))
  if (!user_id || !pin) return NextResponse.json({ error: 'user_id and PIN required' }, { status: 400 })

  const supabase = supabaseServer()
  const { data: user } = await supabase
    .from('users')
    .select('id, name, avatar_url, pin_hash, role, dept_id, active, departments(name)')
    .eq('id', user_id)
    .maybeSingle()

  if (!user || !user.active || !bcrypt.compareSync(pin, user.pin_hash as string)) {
    return NextResponse.json({ error: 'Incorrect PIN. Please try again.' }, { status: 401 })
  }

  const token = signToken({ user_id: user.id as number, name: user.name as string, role: user.role as 'dept_head' | 'corp_planning', dept_id: user.dept_id as string | null })
  const deptName = (user.departments as unknown as { name: string } | null)?.name ?? user.name

  return NextResponse.json({
    token,
    user_id: user.id,
    name: user.name,
    avatar_url: user.avatar_url,
    role: user.role,
    dept_id: user.dept_id,
    dept_name: deptName,
  })
}
