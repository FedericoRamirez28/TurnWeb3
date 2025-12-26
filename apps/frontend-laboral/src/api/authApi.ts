// apps/frontend-laboral/src/api/authApi.ts
import { apiJson } from './http'

export type AuthUser = {
  sub: string
  username: string
  displayName: string
  role: string
}

export async function authMe(): Promise<AuthUser | null> {
  const r = await apiJson<{ user: AuthUser | null }>('/auth/me')
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
  return r.user
}

export async function authLogout(): Promise<void> {
  await apiJson('/auth/logout', { method: 'POST' })
}

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
