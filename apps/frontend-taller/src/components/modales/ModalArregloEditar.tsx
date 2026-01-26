// src/components/modales/ModalArregloEditar.tsx
import React, { useMemo, useState } from 'react'

type Priority = 'baja' | 'alta' | 'urgente'
export type Tarea = { texto: string; completa: boolean }

export type ArregloEditDto = {
  patente: string
  fecha: string
  motivo: string
  anotaciones: string
  prioridad: Priority
  hora_entrada: string
  hora_salida: string
  salida_indefinida: boolean
  tareas: Tarea[]
}

type Props = {
  initial: ArregloEditDto
  onClose: () => void
  onSave: (dto: ArregloEditDto) => Promise<void> | void
}

export default function ModalArregloEditar({ initial, onClose, onSave }: Props) {
  const [form, setForm] = useState<ArregloEditDto>(initial)
  const [saving, setSaving] = useState(false)

  const canSave = useMemo(() => !!form.patente.trim() && !!form.fecha, [form.patente, form.fecha])

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave({
        ...form,
        patente: form.patente.toUpperCase().trim(),
        prioridad: String(form.prioridad || 'baja').toLowerCase() as Priority,
      })
      onClose()
    } finally {
      setSaving(false)
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
        <h2>Editar arreglo</h2>

        <label>
          Patente:
          <input value={form.patente} onChange={(e) => setForm({ ...form, patente: e.currentTarget.value })} />
        </label>

        <div className="row-2">
          <label>
            Fecha:
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.currentTarget.value })} />
          </label>

          <label>
            Prioridad:
            <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.currentTarget.value as Priority })}>
              <option value="baja">🟢 Baja</option>
              <option value="alta">🟡 Alta</option>
              <option value="urgente">🔴 Urgente</option>
            </select>
          </label>
        </div>

        <label>
          Motivo:
          <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.currentTarget.value })} />
        </label>

        <div className="row-2">
          <label>
            Hora de entrada:
            <input
              type="time"
              value={form.hora_entrada}
              onChange={(e) => setForm({ ...form, hora_entrada: e.currentTarget.value })}
            />
          </label>

          <label>
            Hora de salida:
            <div className="row-gap">
              <input
                type="time"
                value={form.salida_indefinida ? '' : form.hora_salida}
                disabled={form.salida_indefinida}
                onChange={(e) => setForm({ ...form, hora_salida: e.currentTarget.value })}
              />
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={form.salida_indefinida}
                  onChange={(e) => setForm({ ...form, salida_indefinida: e.currentTarget.checked })}
                />
                <span>Indefinida</span>
              </label>
            </div>
          </label>
        </div>

        <label>
          Anotaciones:
          <textarea value={form.anotaciones} onChange={(e) => setForm({ ...form, anotaciones: e.currentTarget.value })} />
        </label>

        <div className="acciones">
          <button onClick={handleSave} disabled={!canSave || saving} className="primary">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button onClick={onClose} className="ghost">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
