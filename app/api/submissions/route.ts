import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

// GET /api/submissions?dept_id=&year=&month=
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const dept_id = searchParams.get('dept_id')
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  const supabase = supabaseServer()
  let query = supabase.from('submissions').select('*').eq('dept_id', dept_id).eq('year', year)
  if (month) query = query.eq('month', month)
  const { data: submissions, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ submissions })
}

// POST /api/submissions — body: { dept_id, year, month }
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['dept_head', 'corp_planning'])
  if (auth instanceof NextResponse) return auth

  const { dept_id, year, month } = await request.json().catch(() => ({}))
  if (auth.role === 'dept_head' && auth.dept_id !== dept_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = supabaseServer()
  const { error } = await supabase.from('submissions').upsert(
    { dept_id, year, month },
    { onConflict: 'dept_id,year,month', ignoreDuplicates: true }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
