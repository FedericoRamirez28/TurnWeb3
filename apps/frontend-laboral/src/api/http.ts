// apps/frontend-laboral/src/api/http.ts

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
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()

  if (raw) return stripTrailingSlash(raw)

  // ✅ fallback SOLO en DEV/local
  if (import.meta.env.DEV) return 'http://localhost:4000'

  throw new Error('Falta VITE_API_BASE_URL en el build de producción (Render).')
}

function devHeaders(): Record<string, string> {
  // ✅ DEV: manda x-user-id si existe (tu backend lo acepta)
  if (!import.meta.env.DEV) return {}
  try {
    const id = localStorage.getItem('dev_user_id') || ''
    if (!id.trim()) return {}
    return { 'x-user-id': id.trim() }
  } catch {
    return {}
  }
}

type ApiJsonInit = Omit<RequestInit, 'body'> & {
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
}

export async function apiJson<T>(path: string, init?: ApiJsonInit): Promise<T> {
  const base = getApiBaseUrl()

  const url = new URL(`${base}${path.startsWith('/') ? '' : '/'}${path}`)

  const query = init?.query
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      url.searchParams.set(k, String(v))
    }
  }

  const res = await fetch(url.toString(), {
    method: init?.method ?? 'GET',
    credentials: 'include',
    headers: {
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...devHeaders(),
      ...(init?.headers ?? {}),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `HTTP ${res.status}`

    try {
      const data = text ? (JSON.parse(text) as { message?: unknown; error?: unknown }) : null
      const m = data?.message ?? data?.error
      if (m) msg = Array.isArray(m) ? m.join(' | ') : String(m)
      else if (text) msg = text
    } catch {
      if (text) msg = text
    }

    throw new ApiError(msg, res.status, text)
  }

  // si algún endpoint devuelve vacío/no-json
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    return (undefined as unknown) as T
  }

  return (await res.json()) as T
}
