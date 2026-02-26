// apps/backend-taller/src/modules/calendario/calendario.types.ts

export type Prioridad = 'baja' | 'alta' | 'urgente'

export type CalendarioEvento = {
  fecha: string // YYYY-MM-DD
  prioridad: Prioridad
  tipo: 'arreglo' | 'parte'
  id?: string
}
