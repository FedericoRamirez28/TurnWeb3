// src/components/modales/ModalFormularioArreglo.tsx
import React, { useEffect, useMemo, useState } from 'react'

type Priority = 'baja' | 'alta' | 'urgente'

export type NuevaTarea = { texto: string; completa: boolean }

export type NuevoArregloDto = {
  movil_id: string | null
  patente: string
  fecha: string // YYYY-MM-DD
  anotaciones: string
  motivo: string
  prioridad: Priority
  tareas: NuevaTarea[]
  hora_entrada: string | null // "YYYY-MM-DD HH:mm"
  hora_salida: string | null // "YYYY-MM-DD HH:mm"
  salida_indefinida: boolean
}

type Props = {
  movilId?: string | number | null
  defaultPatente?: string
  onClose: () => void
  onAgregar: (dto: NuevoArregloDto) => Promise<void> | void
}

function fromInputDT(v: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : null
}
function nowLocalDT() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

export default function ModalFormularioArreglo({ movilId, defaultPatente = '', onClose, onAgregar }: Props) {
  const movilStr = useMemo(() => (movilId == null ? '' : String(movilId)), [movilId])

  const [patente, setPatente] = useState('')
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [anotaciones, setAnotaciones] = useState('')
  const [motivo, setMotivo] = useState('')
  const [prioridad, setPrioridad] = useState<Priority>('baja')

  const [tareas, setTareas] = useState<string[]>([])
  const [nuevaTarea, setNuevaTarea] = useState('')

  const [entradaDT, setEntradaDT] = useState(() => nowLocalDT())
  const [salidaDT, setSalidaDT] = useState('')
  const [salidaIndefinida, setSalidaIndefinida] = useState(false)

  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (defaultPatente && !patente) setPatente(String(defaultPatente).toUpperCase())
  }, [defaultPatente, patente])

  const agregarTarea = () => {
    const t = nuevaTarea.trim()
    if (!t) return
    setTareas((prev) => [...prev, t])
    setNuevaTarea('')
  }

  const handleSubmit = async () => {
    if (!patente.trim()) return alert('La patente es obligatoria')

    setCargando(true)
    try {
      const dto: NuevoArregloDto = {
        movil_id: movilStr ? movilStr : null,
        patente: patente.toUpperCase().trim(),
        fecha,
        anotaciones,
        motivo,
        prioridad: String(prioridad || 'baja').toLowerCase() as Priority,
        tareas: tareas.map((t) => ({ texto: t, completa: false })),
        hora_entrada: fromInputDT(entradaDT),
        hora_salida: salidaIndefinida ? null : fromInputDT(salidaDT),
        salida_indefinida: !!salidaIndefinida,
      }

      await onAgregar(dto)
      onClose()
    } finally {
      setCargando(false)
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) onClose()
      }}
    >
      <div className="modal">
        <h2>Nuevo Arreglo</h2>

        <label>
          Móvil:
          <input type="text" value={movilStr} disabled />
        </label>

        <label>
          Patente del móvil:
          <input type="text" value={patente} onChange={(e) => setPatente(e.currentTarget.value)} />
        </label>

        <div className="row-2">
          <label>
            Fecha:
            <input type="date" value={fecha} onChange={(e) => setFecha(e.currentTarget.value)} />
          </label>

          <label>
            Prioridad:
            <select value={prioridad} onChange={(e) => setPrioridad(e.currentTarget.value as Priority)}>
              <option value="baja">🟢 Baja</option>
              <option value="alta">🟡 Alta</option>
              <option value="urgente">🔴 Urgente</option>
            </select>
          </label>
        </div>

        <label>
          Motivo:
          <input type="text" value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} />
        </label>

        <div className="row-2">
          <label>
            Entrada (fecha y hora):
            <input type="datetime-local" value={entradaDT} onChange={(e) => setEntradaDT(e.currentTarget.value)} />
          </label>

          <label>
            Salida (fecha y hora):
            <div className="row-gap">
              <input
                type="datetime-local"
                value={salidaIndefinida ? '' : salidaDT}
                disabled={salidaIndefinida}
                onChange={(e) => setSalidaDT(e.currentTarget.value)}
              />
              <label className="inline-toggle">
                <input type="checkbox" checked={salidaIndefinida} onChange={(e) => setSalidaIndefinida(e.currentTarget.checked)} />
                <span>Indefinida</span>
              </label>
            </div>
          </label>
        </div>

        <label>
          Anotaciones:
          <textarea value={anotaciones} onChange={(e) => setAnotaciones(e.currentTarget.value)} />
        </label>

        <label>Tareas por hacer:</label>
        <div className="checklist">
          <input type="text" value={nuevaTarea} placeholder="Nueva tarea" onChange={(e) => setNuevaTarea(e.currentTarget.value)} />
          <button type="button" onClick={agregarTarea}>
            ➕ Añadir tarea
          </button>
        </div>

        <ul>
          {tareas.map((t, i) => (
            <li key={i}>✔ {t}</li>
          ))}
        </ul>

        <div className="acciones">
          <button onClick={handleSubmit} disabled={cargando} className="primary">
            {cargando ? 'Guardando…' : 'Agregar'}
          </button>
          <button onClick={onClose} className="ghost">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
