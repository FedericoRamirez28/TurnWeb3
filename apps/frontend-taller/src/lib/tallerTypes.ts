export type ColKey = 'Inbox' | 'In progress' | 'Done'

export type Tarea = {
  id?: string
  texto: string
  completa: boolean
}

export type Arreglo = {
  id: string

  // ✅ hacemos estos campos opcionales para compatibilidad con datos viejos
  patente?: string
  fecha?: string
  motivo?: string
  anotaciones?: string
  prioridad?: string

  tareas?: Tarea[]

  salida_indefinida?: boolean | number
  hora_salida?: string | null
}

export type Tablero = Record<ColKey, Arreglo[]>
