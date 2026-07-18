import { NextRequest, NextResponse } from 'next/server'
import dns from 'node:dns/promises'
import net from 'node:net'
import { requireAuth } from '@/lib/auth-server'

export const preferredRegion = 'sin1'

// Basic SSRF guard for a server-side fetch driven by a URL a dept_head previously typed in as
// their KPI's data source — not attacker-controlled at request time, but still worth blocking
// obvious internal-network targets before this route fetches them on the server's behalf.
function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase()
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80') || lower.startsWith('::ffff:127.')
  }
  return true
}

// GET /api/download-source?url=... — streams a KPI's data-source file back with
// Content-Disposition: attachment, so the browser downloads it instead of just navigating to it.
// A plain <a href> can't do this itself: the `download` attribute is ignored for cross-origin URLs
// (Google Drive, Dropbox, SharePoint links, etc.), so without this proxy "download" was really just
// "open in a new tab."
export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const raw = new URL(request.url).searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'url required' }, { status: 400 })

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http(s) URLs are supported' }, { status: 400 })
  }

  try {
    const { address } = await dns.lookup(target.hostname)
    if (isPrivateAddress(address)) {
      return NextResponse.json({ error: 'That address can’t be fetched' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Couldn’t resolve that address' }, { status: 400 })
  }

  let upstream: Response
  try {
    upstream = await fetch(target.toString(), { redirect: 'follow', signal: AbortSignal.timeout(20000) })
  } catch {
    return NextResponse.json({ error: 'Couldn’t reach that source' }, { status: 502 })
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Source file is unavailable' }, { status: 502 })
  }

  const filename = (target.pathname.split('/').filter(Boolean).pop() || 'source-file').replace(/["\r\n]/g, '')
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream'

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
