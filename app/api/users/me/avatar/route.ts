import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-server'

// Supabase project is in ap-southeast (Singapore-area) — pin this function to sin1 so DB
// round-trips don't cross the Pacific to Vercel's default iad1 (US East) region.
export const preferredRegion = 'sin1'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// POST /api/users/me/avatar — multipart/form-data with a single "file" field.
// Uploads through the service-role client (never a direct client-to-Supabase upload) into the
// public "avatars" bucket, then stamps the resulting URL onto the caller's own user row.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: 'Only PNG, JPEG, or WEBP images are allowed' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 })

  const supabase = supabaseServer()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${auth.user_id}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: publicUrl } = supabase.storage.from('avatars').getPublicUrl(path)
  const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl.publicUrl }).eq('id', auth.user_id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ avatar_url: publicUrl.publicUrl })
}
