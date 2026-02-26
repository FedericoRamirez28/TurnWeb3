const KEY = 'ts_token'
const USER_KEY = 'ts_user'

export type AuthUser = {
  id: string
  email: string
  role?: string
}

export function getToken() {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function setToken(token: string) {
  try {
    if (!token) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, token)
  } catch {
    // noop
  }
}

export function getUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

export function setUser(user: AuthUser | null) {
  try {
    if (!user) localStorage.removeItem(USER_KEY)
    else localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {
    // noop
  }
}

export function clearAuth() {
  setToken('')
  setUser(null)
}
