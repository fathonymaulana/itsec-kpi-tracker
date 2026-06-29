'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface AuthUser {
  token: string
  role: 'dept_head' | 'corp_planning' | 'board'
  dept_id: string | null
  dept_name: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  ready: boolean   // true once localStorage has been checked
  login: (dept_id: string, pin: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  ready: false,
  login: async () => {},
  logout: () => {},
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

  const login = async (dept_id: string, pin: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dept_id, pin }),
    })
    if (!res.ok) {
      const e = await res.json()
      throw new Error(e.error || 'Login failed')
    }
    const data = await res.json()
    setUser(data)
    localStorage.setItem('itsec_kpi_user', JSON.stringify(data))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('itsec_kpi_user')
  }

  return (
    <AuthContext.Provider value={{ user, token: user?.token ?? null, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

export function authHeaders(token: string | null) {
  return { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' }
}
