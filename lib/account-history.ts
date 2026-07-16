// Tracks accounts that have successfully signed in on this browser, purely client-side (localStorage) —
// used only to populate the "Switch Account" picker. Never stores a PIN or token, only public profile
// fields, so switching still requires re-entering the target account's PIN on the login page.
export interface AccountHistoryEntry {
  user_id: number
  name: string
  avatar_url: string | null
  role: string
  dept_id: string | null
  dept_name: string
  last_used: string // ISO timestamp
}

const KEY = 'itsec_kpi_account_history'
const MAX_ENTRIES = 6

export function getAccountHistory(): AccountHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function recordAccountUsage(entry: Omit<AccountHistoryEntry, 'last_used'>) {
  if (typeof window === 'undefined') return
  const rest = getAccountHistory().filter(e => e.user_id !== entry.user_id)
  const next = [{ ...entry, last_used: new Date().toISOString() }, ...rest].slice(0, MAX_ENTRIES)
  localStorage.setItem(KEY, JSON.stringify(next))
}

export function forgetAccount(user_id: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(getAccountHistory().filter(e => e.user_id !== user_id)))
}
