const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data: unknown = isJson ? await res.json() : null

  if (!res.ok) {
    const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
    const msg =
      (obj && typeof obj.message === 'string' && obj.message) ||
      (obj && typeof obj.error === 'string' && obj.error) ||
      `Error ${res.status}`
    throw new Error(msg)
  }

  return data as T
}

export type Company = {
  id: string
  nombre: string
  nroSocio?: string | null
  cuit?: string | null
  contacto?: string | null
  telefono?: string | null
  email?: string | null
  domicilio?: string | null
  notas?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CompanyDraft = {
  nombre: string
  nroSocio?: string
  cuit?: string
  contacto?: string
  telefono?: string
  email?: string
  domicilio?: string
  notas?: string
}

export type CompanyPadronPerson = {
  dni: string
  nombre: string
  nroAfiliado: string
  puesto: string
  lastTurnoISO: string
}

export async function listCompanies(input: { q?: string; filter?: 'actives' | 'inactive' | 'all' }) {
  const params = new URLSearchParams()
  if (input.q) params.set('q', input.q)
  if (input.filter) params.set('filter', input.filter)

  return fetchJSON<{ items: Company[] }>(`${API_BASE_URL}/laboral/companies?${params.toString()}`)
}

export async function createCompany(payload: CompanyDraft) {
  return fetchJSON<{ item: Company }>(`${API_BASE_URL}/laboral/companies`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCompany(id: string, patch: Partial<CompanyDraft> & { isActive?: boolean }) {
  return fetchJSON<{ item: Company }>(`${API_BASE_URL}/laboral/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteCompany(id: string) {
  return fetchJSON<{ ok: true }>(`${API_BASE_URL}/laboral/companies/${id}`, {
    method: 'DELETE',
  })
}

/** ✅ NUEVO: padrón sin localStorage */
export async function getCompanyPadron(companyId: string) {
  return fetchJSON<{ items: CompanyPadronPerson[] }>(`${API_BASE_URL}/laboral/companies/${companyId}/padron`)
}
