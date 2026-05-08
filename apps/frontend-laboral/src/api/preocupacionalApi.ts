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

export async function createAdicionalesBatch(items: CreateAdicionalItem[]) {
  return apiJson<{ inserted: number }>('/laboral/preocupacional/adicionales/batch', {
    method: 'POST',
    body: { items }, // ✅ objeto
  })
}

export async function listAdicionales(params?: {
  from?: string
  to?: string
  q?: string
  empresa?: string
}) {
  return apiJson<LaboralAdicional[]>('/laboral/preocupacional/adicionales', {
    query: {
      from: params?.from?.trim() || undefined,
      to: params?.to?.trim() || undefined,
      q: params?.q?.trim() || undefined,
      empresa: params?.empresa?.trim() || undefined,
    },
  })
}

export async function deleteAdicional(id: string) {
  return apiJson<{ ok: true }>(
    `/laboral/preocupacional/adicionales/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}
