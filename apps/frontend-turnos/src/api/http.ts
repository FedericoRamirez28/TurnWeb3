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

function getEnv(): Record<string, string> {
  const meta = import.meta as unknown as { env?: Record<string, string> }
  return meta.env ?? {}
}

export function getApiBaseUrl(): string {
  const env = getEnv()
  const raw = (env.VITE_API_BASE_URL || '').trim()
  const fallback = 'http://localhost:4000'
  return (raw || fallback).replace(/\/$/, '')
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl()
  const url =
    path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(`API ${res.status}: ${text || res.statusText}`, res.status, text)
  }

  return (await res.json()) as T
}
