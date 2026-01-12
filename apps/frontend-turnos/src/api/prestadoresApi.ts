import { apiJson } from './http'

export type PrestadorListItem = {
  id: string
  nombre: string
  isActive: boolean
}

export type CreatePrestadorPayload = {
  username: string
  password: string
  displayName?: string

  nombre: string
  razonSocial?: string | null
  cuit?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
}

export async function fetchPrestadores(): Promise<PrestadorListItem[]> {
  return apiJson<PrestadorListItem[]>('/prestadores')
}

export async function createPrestador(payload: CreatePrestadorPayload) {
  return apiJson<{
    user: { id: string; username: string; displayName: string; role: string }
    prestador: { id: string; nombre: string; isActive: boolean; userId: string }
  }>('/prestadores', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
