// apps/frontend-laboral/src/api/consultoriosApi.ts
import { apiJson } from './http'

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

export async function listConsultorios(params: {
  from?: string
  to?: string
  q?: string
  companyId?: string
  take?: number
}): Promise<ConsultorioTurno[]> {
  return apiJson<ConsultorioTurno[]>('/laboral/consultorios', {
    query: {
      from: params.from?.trim() || undefined,
      to: params.to?.trim() || undefined,
      q: params.q?.trim() || undefined,
      companyId: params.companyId?.trim() || undefined,
      take: params.take ?? undefined,
    },
  })
}

export async function createConsultorioTurno(
  dto: CreateConsultorioTurnoDto,
): Promise<ConsultorioTurno> {
  // ✅ body como objeto
  return apiJson<ConsultorioTurno>('/laboral/consultorios', {
    method: 'POST',
    body: dto,
  })
}

export async function deleteConsultorioTurno(id: string): Promise<{ ok: true }> {
  return apiJson<{ ok: true }>(`/laboral/consultorios/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
