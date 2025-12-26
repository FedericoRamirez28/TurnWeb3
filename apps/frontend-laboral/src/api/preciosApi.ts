// apps/frontend-laboral/src/api/preciosApi.ts
import { apiJson, ApiError } from './http'

export type PlanKey = 'ALL' | 'BASE' | 'ESMERALDA' | 'RUBI' | 'DORADO' | 'PARTICULAR'
export type PlanClave = Exclude<PlanKey, 'ALL'>
export type ScopeKey = 'laboratorio' | 'especialidad' | 'ambos'
export type ModeKey = 'increase' | 'decrease'

export type TurnosPrecioTipoDB = 'LABORATORIO' | 'ESPECIALIDAD'

export type TurnosPrecioRowDB = {
  id: string
  tipo: TurnosPrecioTipoDB
  nombre: string
  plan: PlanClave
  valor: number
  isActive?: boolean
  createdAt?: string
  updatedAt: string
}

export type LaboralPrecioRowDB = {
  id: string
  categoria: string
  nombre: string
  valorSocios: number
  valorNoSocios: number
  isActive?: boolean
  createdAt?: string
  updatedAt: string
}

/* =========================
   ENDPOINTS PRECIOS TURNOS
   ========================= */

export type ListTurnosPreciosResponse = { rows: TurnosPrecioRowDB[] }

export async function listTurnosPrecios(params: {
  plan: PlanKey
  scope: ScopeKey
  q?: string
}): Promise<ListTurnosPreciosResponse> {
  const q = (params.q ?? '').trim()
  return apiJson<ListTurnosPreciosResponse>('/laboral/precios/turnos/rows', {
    query: { plan: params.plan, scope: params.scope, q: q || undefined },
  })
}

export async function adjustTurnosPrecios(body: {
  plan: PlanKey
  scope: ScopeKey
  mode: ModeKey
  percent: number
}): Promise<{ updated: number }> {
  return apiJson<{ updated: number }>('/laboral/precios/turnos/adjust', {
    method: 'POST',
    body,
  })
}

export type TurnosBundleFromApi = {
  laboratoriosTarifas: Record<PlanClave, Record<string, number>>
  especialidadesTarifas: Record<PlanClave, Record<string, number>>
  laboratorioOptions: string[]
  especialidadesOptions: string[]
  updatedAt: string
}

export async function getTurnosBundle(): Promise<TurnosBundleFromApi> {
  return apiJson<TurnosBundleFromApi>('/laboral/precios/turnos/bundle')
}

export type TurnosVersionResponse = { updatedAt: string }
export async function getTurnosVersion(): Promise<TurnosVersionResponse> {
  return apiJson<TurnosVersionResponse>('/laboral/precios/turnos/version')
}

/* ==============================
   ENDPOINTS PRECIOS LABORAL (PDF)
   ============================== */

export type ListLaboralPreciosResponse = { rows: LaboralPrecioRowDB[] }

export async function listLaboralPrecios(params?: {
  categoria?: string
  q?: string
}): Promise<ListLaboralPreciosResponse> {
  const categoria = (params?.categoria ?? '').trim()
  const q = (params?.q ?? '').trim()

  return apiJson<ListLaboralPreciosResponse>('/laboral/precios/laboral/rows', {
    query: {
      categoria: categoria || undefined,
      q: q || undefined,
    },
  })
}

export async function adjustLaboralPrecios(body: {
  categoria?: string
  mode: ModeKey
  percent: number
}): Promise<{ updated: number }> {
  return apiJson<{ updated: number }>('/laboral/precios/laboral/adjust', {
    method: 'POST',
    body,
  })
}

export { ApiError }
