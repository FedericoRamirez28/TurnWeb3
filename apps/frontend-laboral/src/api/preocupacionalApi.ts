// apps/frontend-laboral/src/api/adicionalesApi.ts
import { apiJson } from './http'

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

export function createAdicionalesBatch(items: CreateAdicionalItem[]) {
  return apiJson<{ inserted: number }>('/laboral/preocupacional/adicionales/batch', {
    method: 'POST',
    body: { items },
  })
}

export function listAdicionales(params?: { from?: string; to?: string; q?: string; empresa?: string }) {
  return apiJson<LaboralAdicional[]>('/laboral/preocupacional/adicionales', {
    query: {
      from: params?.from,
      to: params?.to,
      q: params?.q,
      empresa: params?.empresa,
    },
  })
}

export function deleteAdicional(id: string) {
  return apiJson<{ ok: true }>(`/laboral/preocupacional/adicionales/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
