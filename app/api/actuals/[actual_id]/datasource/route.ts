import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ actual_id: string }> }) {
  const auth = requireAuth(request, ['dept_head', 'corp_planning'])
  if (auth instanceof NextResponse) return auth
  const { actual_id } = await params

  const { data_source_url, data_source_note } = await request.json().catch(() => ({}))
  const supabase = supabaseServer()
  const { error } = await supabase
    .from('actuals')
    .update({
      data_source_url: data_source_url || null,
      data_source_note: data_source_note || null,
      last_updated_at: new Date().toISOString(),
    })
    .eq('id', actual_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
