import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// PATCH /api/anomalies/:id — body: { dismissed: 1 } or { resolved_note: '...' }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request, ['corp_planning', 'dept_head'])
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const { dismissed, resolved_note } = await request.json().catch(() => ({}))
  const supabase = supabaseServer()

  if (dismissed !== undefined) {
    const { error } = await supabase.from('anomalies').update({ dismissed: !!dismissed }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (resolved_note !== undefined) {
    const { error } = await supabase.from('anomalies').update({ resolved_note }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
