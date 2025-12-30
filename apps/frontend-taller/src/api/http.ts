import { getApiBaseUrl } from '@/lib/env'

export class ApiError extends Error {
  status: number
  bodyText?: string
  constructor(message: string, status: number, bodyText?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.bodyText = bodyText
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl()
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new ApiError(`API ${res.status} ${res.statusText}`, res.status, txt)
  }

  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return (await res.json()) as T
  return (await res.text()) as T
}

export const api = {
  get: <T,>(p: string) => request<T>(p),
  post: <T,>(p: string, b: unknown) => request<T>(p, { method: 'POST', body: JSON.stringify(b) }),
  put: <T,>(p: string, b: unknown) => request<T>(p, { method: 'PUT', body: JSON.stringify(b) }),
  del: <T,>(p: string) => request<T>(p, { method: 'DELETE' }),
}
