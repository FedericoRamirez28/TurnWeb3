import { apiJson } from '@/api/http'

export type PrestadorListItem = {
  id: string
  nombre: string
  isActive: boolean
}

export async function fetchPrestadores(): Promise<PrestadorListItem[]> {
  const r = await apiJson<{ prestadores: PrestadorListItem[] }>('/prestadores/active')
  return r.prestadores
}

// ===== BONOS =====

export type CreateBonoDto = {
  afiliadoId: string
  prestadorId: string
  turnoId?: string | null
  practica: string
  observaciones?: string | null
  fechaAtencionISO?: string | null
  venceDias: number
}

export type BonoCreated = {
  id: string
  code: string
  expiresAt: string
}

export async function crearBono(dto: CreateBonoDto): Promise<BonoCreated> {
  return await apiJson<BonoCreated>('/bonos-atencion', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export type VerificarBonoResponse = {
  ok: boolean
  status: 'VALID' | 'INVALID' | 'USED' | 'EXPIRED' | 'CANCELLED'
  bono?: {
    id: string
    code: string
    afiliadoNombreSnap: string
    prestadorNombreSnap: string
    practica: string
    expiresAt: string
  }
}

export async function verificarBono(code: string, t?: string): Promise<VerificarBonoResponse> {
  const qs = t ? `?t=${encodeURIComponent(t)}` : ''
  return await apiJson<VerificarBonoResponse>(
    `/bonos-atencion/verificar/${encodeURIComponent(code)}${qs}`,
  )
}

export async function usarBono(code: string): Promise<{ ok: true }> {
  return await apiJson<{ ok: true }>(`/bonos-atencion/${encodeURIComponent(code)}/usar`, {
    method: 'POST',
  })
}
