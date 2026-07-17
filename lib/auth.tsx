'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { recordAccountUsage } from '@/lib/account-history'

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
    const stored = localStorage.getItem('itsec_kpi_user')
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { localStorage.removeItem('itsec_kpi_user') }
    }
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
    localStorage.setItem('itsec_kpi_user', JSON.stringify(data))
    recordAccountUsage({
      user_id: data.user_id,
      name: data.name,
      avatar_url: data.avatar_url ?? null,
      role: data.role,
      dept_id: data.dept_id ?? null,
      dept_name: data.dept_name,
    })
  }

  // Updates the locally-cached profile fields (name/avatar) after a successful self-service edit,
  // without requiring a full re-login.
  const refreshUser = (patch: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem('itsec_kpi_user', JSON.stringify(next))
      recordAccountUsage({
        user_id: next.user_id,
        name: next.name,
        avatar_url: next.avatar_url ?? null,
        role: next.role,
        dept_id: next.dept_id ?? null,
        dept_name: next.dept_name,
      })
      return next
    })
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('itsec_kpi_user')
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
