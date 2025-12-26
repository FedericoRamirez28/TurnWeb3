// apps/frontend-laboral/src/api/companiesApi.ts
import { apiJson } from './http'

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

  return apiJson<{ items: Company[] }>(`/laboral/companies?${params.toString()}`)
}

export async function createCompany(payload: CompanyDraft) {
  return apiJson<{ item: Company }>('/laboral/companies', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateCompany(id: string, patch: Partial<CompanyDraft> & { isActive?: boolean }) {
  return apiJson<{ item: Company }>(`/laboral/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function deleteCompany(id: string) {
  return apiJson<{ ok: true }>(`/laboral/companies/${id}`, {
    method: 'DELETE',
  })
}

/** ✅ padrón sin localStorage */
export async function getCompanyPadron(companyId: string) {
  return apiJson<{ items: CompanyPadronPerson[] }>(`/laboral/companies/${companyId}/padron`)
}
