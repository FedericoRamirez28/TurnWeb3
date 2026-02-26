import { clearAuth, getToken } from './auth'

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001'

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

function joinUrl(base: string, path: string) {
  const b = String(base || '').replace(/\/+$/, '')
  const p = String(path || '')
  return `${b}${p.startsWith('/') ? '' : '/'}${p}`
}

function withQuery(path: string, query?: Record<string, any>) {
  if (!query) return path
  const qs = new URLSearchParams()
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    qs.set(k, String(v))
  })
  const s = qs.toString()
  if (!s) return path
  return `${path}${path.includes('?') ? '&' : '?'}${s}`
}

async function safeJson(r: Response) {
  const ct = r.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return null
  try {
    return await r.json()
  } catch {
    return null
  }
}

function normalizeApiResult<T>(r: Response, j: any): ApiResult<T> {
  // Caso ideal: backend responde { ok, data|error }
  if (j && typeof j === 'object' && 'ok' in j) {
    const ok = !!j.ok
    if (!ok && (r.status === 401 || r.status === 403)) clearAuth()

    // ✅ Si no hay "data", devolvemos el payload completo (NO adivinamos)
    if (ok && !('data' in j)) {
      return { ok: true, data: j as T }
    }

    return j as ApiResult<T>
  }

  // No es ApiResult -> normalizamos
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) clearAuth()
    const msg =
      (j && (j.error || j.message)) ||
      `HTTP ${r.status}${r.statusText ? ` ${r.statusText}` : ''}`
    return { ok: false, error: String(msg) }
  }

  return { ok: true, data: (j as T) ?? (null as any) }
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: any,
  opts?: { query?: Record<string, any>; headers?: Record<string, string> },
): Promise<ApiResult<T>> {
  const url = joinUrl(API_BASE, withQuery(path, opts?.query))

  const token = getToken()

  const headers: Record<string, string> = { ...(opts?.headers || {}) }
  if (body !== undefined) headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const r = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      mode: 'cors',
    })

    if (r.status === 204) return { ok: true, data: null as any }

    const j = await safeJson(r)
    return normalizeApiResult<T>(r, j)
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor (network/CORS).' }
  }
}

export const api = {
  base: API_BASE,

  get: <T>(path: string, query?: Record<string, any>) =>
    request<T>('GET', path, undefined, { query }),

  post: <T>(path: string, body?: any, query?: Record<string, any>) =>
    request<T>('POST', path, body, { query }),

  put: <T>(path: string, body?: any, query?: Record<string, any>) =>
    request<T>('PUT', path, body, { query }),

  patch: <T>(path: string, body?: any, query?: Record<string, any>) =>
    request<T>('PATCH', path, body, { query }),

  del: <T>(path: string, query?: Record<string, any>) =>
    request<T>('DELETE', path, undefined, { query }),
}
