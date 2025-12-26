// apps/frontend-turnos/src/api/http.ts

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

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

export function getApiBaseUrl(): string {
  // ✅ usar import.meta.env directo (Vite lo inyecta en build)
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()

  if (raw) return stripTrailingSlash(raw)

  // ✅ fallback SOLO en DEV/local
  if (import.meta.env.DEV) return 'http://localhost:4000'

  throw new Error('Falta VITE_API_BASE_URL en el build de producción (Render).')
}

function devHeaders(): Record<string, string> {
  // ✅ tu backend permite x-user-id (lo usás para dev)
  if (!import.meta.env.DEV) return {}
  try {
    const id = localStorage.getItem('dev_user_id') || ''
    if (!id.trim()) return {}
    return { 'x-user-id': id.trim() }
  } catch {
    return {}
  }
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
      ...devHeaders(),
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(`API ${res.status}: ${text || res.statusText}`, res.status, text)
  }

  return (await res.json()) as T
}
