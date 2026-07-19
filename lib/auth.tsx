'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface AuthUser {
  token: string
  user_id: number
  name: string
  avatar_url: string | null
  role: 'dept_head' | 'corp_planning'
  dept_id: string | null
  dept_name: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  ready: boolean   // true once localStorage has been checked
  login: (user_id: number, pin: string) => Promise<void>
  logout: () => void
  refreshUser: (patch: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  ready: false,
  login: async () => {},
  logout: () => {},
  refreshUser: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // localStorage can throw (private browsing, strict privacy settings, some mobile browser
    // configurations) — this runs unconditionally on every app load in the root layout, so an
    // unguarded throw here previously crashed the entire app before anything could render. Falling
    // through to unauthenticated is the safe default; `ready` still flips so pages stop skeleton-
    // loading and redirect to /login instead of hanging forever.
    try {
      const stored = localStorage.getItem('itsec_kpi_user')
      if (stored) {
        try { setUser(JSON.parse(stored)) } catch { localStorage.removeItem('itsec_kpi_user') }
      }
    } catch { /* storage unavailable — proceed unauthenticated */ }
    setReady(true)
  }, [])

  const login = async (user_id: number, pin: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, pin }),
    })
    if (!res.ok) {
      const e = await res.json()
      throw new Error(e.error || 'Login failed')
    }
    const data = await res.json()
    setUser(data)
    try { localStorage.setItem('itsec_kpi_user', JSON.stringify(data)) } catch { /* storage unavailable — session stays in-memory only */ }
  }

  // Updates the locally-cached profile fields (name/avatar) after a successful self-service edit,
  // without requiring a full re-login.
  const refreshUser = (patch: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      try { localStorage.setItem('itsec_kpi_user', JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }

  const logout = () => {
    setUser(null)
    try { localStorage.removeItem('itsec_kpi_user') } catch { /* storage unavailable */ }
  }

  return (
    <AuthContext.Provider value={{ user, token: user?.token ?? null, ready, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export function authHeaders(token: string | null) {
  return { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' }
}
