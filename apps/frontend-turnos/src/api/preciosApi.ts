export type PlanKey = 'ALL' | 'BASE' | 'ESMERALDA' | 'RUBI' | 'DORADO' | 'PARTICULAR'
export type PlanClave = Exclude<PlanKey, 'ALL'>
export type ScopeKey = 'laboratorio' | 'especialidad' | 'ambos'
export type ModeKey = 'increase' | 'decrease'

export type TurnosPrecioTipoDB = 'LABORATORIO' | 'ESPECIALIDAD'

export type TurnosPrecioRowDB = {
  id: string
  tipo: TurnosPrecioTipoDB
  nombre: string
  plan: PlanClave
  valor: number
  isActive?: boolean
  createdAt?: string
  updatedAt: string
}

export class ApiError extends Error {
  status: number
  bodyText?: string
  constructor(status: number, message: string, bodyText?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.bodyText = bodyText
  }
}

function getApiBase(): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim()
  return base.replace(/\/$/, '')
}

type ApiJsonInit = Omit<RequestInit, 'body'> & {
  body?: unknown
  query?: Record<string, string | number | boolean | null | undefined>
}

async function apiJson<T>(path: string, init?: ApiJsonInit): Promise<T> {
  const base = getApiBase()
  if (!base) throw new Error('Falta VITE_API_BASE_URL en el .env del frontend-laboral')

  const url = new URL(`${base}${path}`)
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
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `Error ${res.status}`
    try {
      const data = text ? (JSON.parse(text) as { message?: unknown; error?: unknown }) : null
      if (data?.message) msg = Array.isArray(data.message) ? data.message.join(' | ') : String(data.message)
      else if (data?.error) msg = String(data.error)
    } catch {
      // ignore
    }
    throw new ApiError(res.status, msg, text)
  }

  return (await res.json()) as T
}

/* =========================
   ENDPOINTS PRECIOS TURNOS
   ========================= */

export type ListTurnosPreciosResponse = { rows: TurnosPrecioRowDB[] }

export async function listTurnosPrecios(params: { plan: PlanKey; scope: ScopeKey; q?: string }): Promise<ListTurnosPreciosResponse> {
  const q = (params.q ?? '').trim()
  return apiJson<ListTurnosPreciosResponse>('/laboral/precios/turnos/rows', {
    query: {
      plan: params.plan,
      scope: params.scope,
      q: q || undefined,
    },
  })
}

export async function adjustTurnosPrecios(body: { plan: PlanKey; scope: ScopeKey; mode: ModeKey; percent: number }): Promise<{ updated: number }> {
  return apiJson<{ updated: number }>('/laboral/precios/turnos/adjust', {
    method: 'POST',
    body,
  })
}

export type TurnosBundleFromApi = {
  laboratoriosTarifas: Record<PlanClave, Record<string, number>>
  especialidadesTarifas: Record<PlanClave, Record<string, number>>
  laboratorioOptions: string[]
  especialidadesOptions: string[]
  updatedAt: string
}

// ✅ alias para que tu hook use el nombre BundleTurnosResponse
export type BundleTurnosResponse = TurnosBundleFromApi

export async function getTurnosBundle(): Promise<TurnosBundleFromApi> {
  return apiJson<TurnosBundleFromApi>('/laboral/precios/turnos/bundle')
}

// opcional (si existe en backend)
export type TurnosVersionResponse = { updatedAt: string }
export async function getTurnosVersion(): Promise<TurnosVersionResponse> {
  return apiJson<TurnosVersionResponse>('/laboral/precios/turnos/version')
}
