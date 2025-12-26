export type ConsultorioTurno = {
  id: string
  empresaId: string
  empresaNombre: string

  dni: string
  nombre: string
  nacimientoISO: string | null
  motivo: string
  diagnostico: string

  fechaTurnoISO: string
  createdAt: string
}

export type CreateConsultorioTurnoDto = {
  companyId: string
  dni: string
  nombre: string
  nacimientoISO?: string
  motivo: string
  diagnostico: string
  fechaTurnoISO: string
}

const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'
const API_BASE = RAW_BASE.replace(/\/+$/, '')

function devHeaders(): Record<string, string> {
  if (!import.meta.env.DEV) return {}
  const id = localStorage.getItem('dev_user_id') || ''
  if (!id.trim()) return {} // backend devolverá 401 claro
  return { 'x-user-id': id.trim() }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...devHeaders(),
      ...(init?.headers || {}),
    },
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data: unknown = isJson ? await res.json().catch(() => null) : null

  if (!res.ok) {
    const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
    const msg =
      (obj && typeof obj.message === 'string' && obj.message) ||
      (obj && typeof obj.error === 'string' && obj.error) ||
      `HTTP ${res.status}`
    throw new Error(msg)
  }

  return data as T
}

export async function listConsultorios(params: {
  from?: string
  to?: string
  q?: string
  companyId?: string
  take?: number
}): Promise<ConsultorioTurno[]> {
  const sp = new URLSearchParams()
  if (params.from) sp.set('from', params.from)
  if (params.to) sp.set('to', params.to)
  if (params.q) sp.set('q', params.q)
  if (params.companyId) sp.set('companyId', params.companyId)
  if (params.take) sp.set('take', String(params.take))

  const qs = sp.toString()
  return http<ConsultorioTurno[]>(`/laboral/consultorios${qs ? `?${qs}` : ''}`)
}

export async function createConsultorioTurno(dto: CreateConsultorioTurnoDto): Promise<ConsultorioTurno> {
  return http<ConsultorioTurno>(`/laboral/consultorios`, {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function deleteConsultorioTurno(id: string): Promise<{ ok: true }> {
  return http<{ ok: true }>(`/laboral/consultorios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
