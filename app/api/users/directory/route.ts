import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// Must stay dynamic — with no request-dependent APIs used, Next.js would otherwise statically
// optimize this route and freeze the user list at build time, hiding anyone added later.
export const dynamic = 'force-dynamic'

// GET /api/users/directory — intentionally public (no auth): the login page needs this to populate
// the "who are you" picker before a token exists. Never returns pin_hash or any other credential.
export async function GET() {
  const supabase = supabaseServer()
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, role, dept_id, departments(name)')
    .eq('active', true)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const directory = (users || []).map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    dept_id: u.dept_id,
    dept_name: (u.departments as unknown as { name: string } | null)?.name ?? null,
  }))
  return NextResponse.json({ users: directory })
}
