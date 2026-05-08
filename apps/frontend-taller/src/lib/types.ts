export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export type Prioridad = 'baja' | 'alta' | 'urgente'

export type Movil = {
  id: string
  numero: number
  patente: string
  modelo?: string | null
  tamano?: string | null
  prioridad?: Prioridad | null
  estado?: 'ok' | 'warn' | 'alert' | null
}
