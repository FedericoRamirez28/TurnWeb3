export type CreateAdicionalItem = {
  empresa: string
  nroAfiliado?: string
  nombre: string
  dni: string
  adicional: string
  fechaISO: string // YYYY-MM-DD
}

export type LaboralAdicional = CreateAdicionalItem & {
  id: string
  createdAt: string
}

const BASE = import.meta.env.VITE_API_BASE_URL || '' // ajustá si tu proyecto usa otro nombre

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // ✅ DEV: si todavía no tenés auth, podés setear un user fijo
      'x-user-id': 'dev-user',
      ...(init?.headers || {}),
    },
  })

  const txt = await res.text()
  const data = txt ? JSON.parse(txt) : null

  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`
    throw new Error(msg)
  }

  return data as T
}

export function createAdicionalesBatch(items: CreateAdicionalItem[]) {
  return http<{ inserted: number }>('/laboral/preocupacional/adicionales/batch', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}

export function listAdicionales(params?: { from?: string; to?: string; q?: string; empresa?: string }) {
  const qs = new URLSearchParams()
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.q) qs.set('q', params.q)
  if (params?.empresa) qs.set('empresa', params.empresa)
  const suf = qs.toString() ? `?${qs.toString()}` : ''
  return http<LaboralAdicional[]>(`/laboral/preocupacional/adicionales${suf}`)
}

export function deleteAdicional(id: string) {
  return http<{ ok: true }>(`/laboral/preocupacional/adicionales/${id}`, { method: 'DELETE' })
}
