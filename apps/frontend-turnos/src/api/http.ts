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
  const raw = (env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

  // En prod NO queremos “caer” a localhost nunca.
  const isProd = (env.MODE || '').toLowerCase() === 'production'

  if (!raw) {
    if (isProd) {
      throw new Error('Falta VITE_API_BASE_URL en producción (build de Render).')
    }
    // dev fallback OK
    return 'http://localhost:4000'
  }

  return raw
}

type ApiJsonInit = Omit<RequestInit, 'body'> & { body?: unknown }

export async function apiJson<T>(path: string, init?: ApiJsonInit): Promise<T> {
  const base = getApiBaseUrl()

  const url =
    path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ApiError(`API ${res.status}: ${text || res.statusText}`, res.status, text)
  }

  return (await res.json()) as T
}
