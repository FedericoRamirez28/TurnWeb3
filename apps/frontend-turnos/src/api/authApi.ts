// apps/frontend-turnos/src/api/authApi.ts
import { apiJson } from './http'

/* ========= Tipos ========= */

export type AuthUser = {
  sub: string
  username: string
  displayName: string
  role: string
}

/* ========= DEV: persistir userId para x-user-id ========= */

function syncDevUserId(user: AuthUser | null) {
  if (!import.meta.env.DEV) return
  try {
    if (user?.sub) localStorage.setItem('dev_user_id', user.sub)
    else localStorage.removeItem('dev_user_id')
  } catch {
    // no-op
  }
}

/* ========= Auth API ========= */

export async function authMe(): Promise<AuthUser | null> {
  const r = await apiJson<{ user: AuthUser | null }>('/auth/me')
  syncDevUserId(r.user)
  return r.user
}

export async function authLogin(
  username: string,
  password: string,
  remember: boolean,
): Promise<AuthUser> {
  const r = await apiJson<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, remember }),
  })
  syncDevUserId(r.user)
  return r.user
}

export async function authRegister(
  username: string,
  password: string,
  displayName: string | undefined,
  remember: boolean,
): Promise<AuthUser> {
  const r = await apiJson<{ user: AuthUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName, remember }),
  })
  syncDevUserId(r.user)
  return r.user
}

export async function authLogout(): Promise<void> {
  await apiJson('/auth/logout', { method: 'POST' })
  syncDevUserId(null)
}

/* ========= Password reset ========= */

export async function requestPasswordReset(username: string): Promise<string> {
  const r = await apiJson<{ ok: true; token: string }>('/auth/password/request', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
  return r.token
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiJson<{ ok: true }>('/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  })
}
