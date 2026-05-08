// apps/frontend-turnos/src/api/bonosAtencionApi.ts
import { apiJson } from '@/api/http'

/** ====== Prestadores ====== */
export type PrestadorListItem = {
  id: string
  nombre: string
}

/** ====== Bonos (verify) ====== */
export type BonoStatus = 'ISSUED' | 'USED' | 'CANCELLED' | 'EXPIRED'

export type BonoDto = {
  id: string
  code: string

  afiliadoId: string
  prestadorId: string

  turnoId?: string | null

  afiliadoNombreSnap: string
  afiliadoDniSnap: string
  prestadorNombreSnap: string

  practica: string
  observaciones?: string | null
  fechaAtencionISO?: string | null

  issuedAt: string
  expiresAt: string

  status: BonoStatus
  usedAt?: string | null
}

export type BonoVerifyResp = {
  ok: boolean
  status: BonoStatus
  bono: BonoDto
}

/** ====== Crear bono ====== */
export type CreateBonoAtencionDto = {
  afiliadoId: string
  prestadorId: string
  practica: string

  // opcionales
  observaciones?: string
  fechaAtencionISO?: string // YYYY-MM-DD
  venceDias?: number
  turnoId?: string
}

/** =========================
 * ENDPOINTS (backend)
 * - GET  /prestadores/active
 * - POST /bonos-atencion
 * - GET  /bonos-atencion/verificar/:code?t=...
 * - POST /bonos-atencion/:code/usar
 * ========================= */

export async function fetchPrestadores(): Promise<PrestadorListItem[]> {
  return apiJson<PrestadorListItem[]>('/prestadores/active', { method: 'GET' })
}

export async function crearBono(dto: CreateBonoAtencionDto): Promise<BonoDto> {
  return apiJson<BonoDto>('/bonos-atencion', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function verificarBono(code: string, token?: string): Promise<BonoVerifyResp> {
  const q = token ? `?t=${encodeURIComponent(token)}` : ''
  return apiJson<BonoVerifyResp>(`/bonos-atencion/verificar/${encodeURIComponent(code)}${q}`, {
    method: 'GET',
  })
}

export async function usarBono(code: string): Promise<{ ok: true; bono: BonoDto }> {
  return apiJson<{ ok: true; bono: BonoDto }>(`/bonos-atencion/${encodeURIComponent(code)}/usar`, {
    method: 'POST',
  })
}
