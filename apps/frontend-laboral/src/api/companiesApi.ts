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

export async function listCompanies(input: {
  q?: string
  filter?: 'actives' | 'inactive' | 'all'
}) {
  return apiJson<{ items: Company[] }>('/laboral/companies', {
    query: {
      q: input.q?.trim() || undefined,
      filter: input.filter || undefined,
    },
  })
}

export async function createCompany(payload: CompanyDraft) {
  // ✅ NO JSON.stringify acá (apiJson ya serializa)
  return apiJson<{ item: Company }>('/laboral/companies', {
    method: 'POST',
    body: payload,
  })
}

export async function updateCompany(
  id: string,
  patch: Partial<CompanyDraft> & { isActive?: boolean },
) {
  // ✅ encode del id
  return apiJson<{ item: Company }>(`/laboral/companies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
  })
}

export async function deleteCompany(id: string) {
  return apiJson<{ ok: true }>(`/laboral/companies/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/** ✅ padrón sin localStorage */
export async function getCompanyPadron(companyId: string) {
  return apiJson<{ items: CompanyPadronPerson[] }>(
    `/laboral/companies/${encodeURIComponent(companyId)}/padron`,
  )
}
