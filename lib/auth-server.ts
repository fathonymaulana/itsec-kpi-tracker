import 'server-only'
import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'

export interface AuthPayload {
  role: 'dept_head' | 'corp_planning' | 'board'
  dept_id: string | null
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Missing JWT_SECRET environment variable')
  return secret
}

export function signToken(payload: AuthPayload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: '8h' })
}

// Verifies the Bearer token on `request` and checks the caller's role against `roles` (if given, empty
// means "any authenticated role"). Returns the decoded payload on success, or a ready-to-return
// NextResponse (401/403) on failure — callers do `const auth = requireAuth(req); if (auth instanceof
// NextResponse) return auth`.
export function requireAuth(request: NextRequest, roles: AuthPayload['role'][] = []): AuthPayload | NextResponse {
  const token = (request.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 })
  try {
    const decoded = jwt.verify(token, jwtSecret()) as AuthPayload
    if (roles.length && !roles.includes(decoded.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return decoded
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
