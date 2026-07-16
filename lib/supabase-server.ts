import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Server-only: uses the service-role key, which bypasses Row Level Security entirely. Never import this
// file from a client component — the `server-only` import above makes any such mistake a build error.
// All authorization is enforced in app/api/** via requireAuth() (lib/auth-server.ts), not by Postgres RLS.
//
// Untyped on purpose (no generated `Database` type) — this is a small internal tool and the route
// handlers already narrow every response shape explicitly before returning JSON, so hand-maintaining a
// full generated-types file wasn't worth the upkeep. If the schema grows a lot, generate one with
// `supabase gen types typescript` and pass it as createClient<Database>(...).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any, 'public', any> | null = null

export function supabaseServer() {
  if (!client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = createClient<any, 'public', any>(url, key, {
      auth: { persistSession: false },
      // Without this, Next.js's fetch-patching hands every supabase-js request to Vercel's Data Cache,
      // which persists across deployments (unlike route-level `dynamic = 'force-dynamic'`, which only
      // controls whether the route handler itself is statically rendered). That's how a single row
      // deleted from the DB kept reappearing in API responses through multiple redeploys.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    })
  }
  return client
}
