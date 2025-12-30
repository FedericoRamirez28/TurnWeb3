// src/components/modales/ModalArregloDetalle.tsx
import React, { useMemo, useState } from 'react'
import { api } from '@/lib/api'
import type { Arreglo, Tarea } from '@/lib/tallerTypes'

type Priority = 'baja' | 'alta' | 'urgente'

type Props = {
  arreglo: Arreglo
  onCancel: () => void
  onSave: (actualizado: Arreglo, nuevasTareas: Tarea[], moverADone: boolean) => void
}

function hhmmNow(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ModalArregloDetalle({ arreglo, onCancel, onSave }: Props) {
  const [modoEdicion, setModoEdicion] = useState(false)

  const initial = useMemo(
    () => ({
      patente: arreglo.patente || '',
      fecha: arreglo.fecha || '',
      motivo: arreglo.motivo ?? '',
      anotaciones: arreglo.anotaciones ?? '',
      tareas: Array.isArray(arreglo.tareas) ? arreglo.tareas : [],
      prioridad: (String(arreglo.prioridad || 'baja').toLowerCase() as Priority) || 'baja',
      hora_entrada: (arreglo as any).hora_entrada || '',
      hora_salida: arreglo.hora_salida || '',
      salida_indefinida: !!(arreglo as any).salida_indefinida,
    }),
    [arreglo],
  )

  const [form, setForm] = useState(initial)

  const persistir = async (actualizado: Arreglo, moverADone: boolean) => {
    await api.put(`/arreglos/${encodeURIComponent(actualizado.id)}`, {
      ...actualizado,
      // compat: si tu backend usa movil_id
      movil_id: (actualizado as any).movil_id ?? (arreglo as any).movil_id ?? null,
      // compat: si tu backend usa hora_entrada
      hora_entrada: (actualizado as any).hora_entrada ?? (form as any).hora_entrada ?? null,
      salida_indefinida: !!(actualizado as any).salida_indefinida,
    })

    // upsert historial día (si lo estás usando)
    await api.post('/historial-dia', {
      fecha: actualizado.fecha || form.fecha || null,
      movil_id: (actualizado as any).movil_id ?? (arreglo as any).movil_id ?? null,
      patente: (actualizado.patente || form.patente || '').toUpperCase(),
      hora_entrada: (actualizado as any).hora_entrada ?? (form as any).hora_entrada ?? null,
      hora_salida: (actualizado as any).salida_indefinida ? null : (actualizado.hora_salida ?? null),
      salida_indefinida: !!(actualizado as any).salida_indefinida,
      anotaciones: actualizado.anotaciones ?? '',
      prioridad: String(actualizado.prioridad || 'baja').toLowerCase(),
      arreglo_id: actualizado.id,
      motivo: actualizado.motivo ?? null,
    })

    window.dispatchEvent(new Event('ts:historial-dia:refetch'))
    window.dispatchEvent(new CustomEvent('ts:calendar:refresh'))

    onSave(actualizado, actualizado.tareas || [], moverADone)
  }

  const toggleTarea = async (index: number) => {
    const nuevasTareas = (form.tareas || []).map((t, i) => (i === index ? { ...t, completa: !t.completa } : t))
    const completo = nuevasTareas.length > 0 ? nuevasTareas.every((t) => t.completa) : false

    let horaSalida = form.hora_salida
    if (completo && !form.salida_indefinida && !horaSalida) horaSalida = hhmmNow()

    const actualizado: Arreglo = {
      ...arreglo,
      ...form,
      patente: (form.patente || arreglo.patente || '').toUpperCase(),
      fecha: form.fecha || arreglo.fecha,
      hora_salida: horaSalida || null,
      tareas: nuevasTareas,
      ...(form.salida_indefinida ? { salida_indefinida: true } : { salida_indefinida: false }),
      // compat hora_entrada
      ...(form.hora_entrada ? { hora_entrada: form.hora_entrada } : {}),
    } as any

    setForm((f) => ({ ...f, tareas: nuevasTareas, hora_salida: horaSalida }))
    await persistir(actualizado, completo)
  }

  const agregarTarea = () => {
    setForm((f) => ({ ...f, tareas: [...(f.tareas || []), { texto: '', completa: false }] }))
  }

  const handleGuardar = async () => {
    const moverADone = (form.tareas || []).length > 0 ? (form.tareas || []).every((t) => t.completa) : false

    let horaSalida = form.hora_salida
    if (moverADone && !form.salida_indefinida && !horaSalida) horaSalida = hhmmNow()

    const actualizado: Arreglo = {
      ...arreglo,
      ...form,
      patente: (form.patente || arreglo.patente || '').toUpperCase(),
      fecha: form.fecha || arreglo.fecha,
      hora_salida: form.salida_indefinida ? null : (horaSalida || null),
      tareas: form.tareas || [],
      ...(form.salida_indefinida ? { salida_indefinida: true } : { salida_indefinida: false }),
      ...(form.hora_entrada ? { hora_entrada: form.hora_entrada } : {}),
    } as any

    await persistir(actualizado, moverADone)
    setModoEdicion(false)
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if ((e.target as HTMLElement).classList.contains('modal-overlay')) onCancel()
      }}
    >
      <div className="modal">
        <h2>Detalles del arreglo</h2>

        {modoEdicion ? (
          <>
            <label>
              Patente:
              <input
                type="text"
                value={form.patente}
                onChange={(e) => setForm({ ...form, patente: e.currentTarget.value })}
              />
            </label>

            <div className="row-2">
              <label>
                Fecha:
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.currentTarget.value })} />
              </label>

              <label>
                Prioridad:
                <select
                  value={form.prioridad}
                  onChange={(e) => setForm({ ...form, prioridad: e.currentTarget.value as Priority })}
                >
                  <option value="baja">🟢 Baja</option>
                  <option value="alta">🟡 Alta</option>
                  <option value="urgente">🔴 Urgente</option>
                </select>
              </label>
            </div>

            <label>
              Motivo:
              <input type="text" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.currentTarget.value })} />
            </label>

            <div className="row-2">
              <label>
                Hora de entrada:
                <input
                  type="time"
                  value={form.hora_entrada || ''}
                  onChange={(e) => setForm({ ...form, hora_entrada: e.currentTarget.value })}
                />
              </label>

              <label>
                Hora de salida:
                <div className="row-gap">
                  <input
                    type="time"
                    value={form.salida_indefinida ? '' : form.hora_salida || ''}
                    disabled={form.salida_indefinida}
                    onChange={(e) => setForm({ ...form, hora_salida: e.currentTarget.value })}
                  />

                  <button
                    type="button"
                    className={`btn ${form.salida_indefinida ? 'primary' : 'ghost'}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        salida_indefinida: !f.salida_indefinida,
                        hora_salida: !f.salida_indefinida ? '' : f.hora_salida,
                      }))
                    }
                  >
                    {form.salida_indefinida ? 'Salida: indefinida ✓' : 'Salida indefinida'}
                  </button>
                </div>
              </label>
            </div>

            <label>
              Anotaciones:
              <textarea value={form.anotaciones} onChange={(e) => setForm({ ...form, anotaciones: e.currentTarget.value })} />
            </label>

            <h3>Checklist</h3>
            <ul>
              {(form.tareas || []).map((t, i) => (
                <li key={i}>
                  <input
                    type="text"
                    value={t.texto}
                    onChange={(e) => {
                      const nv = [...(form.tareas || [])]
                      nv[i] = { ...nv[i], texto: e.currentTarget.value }
                      setForm({ ...form, tareas: nv })
                    }}
                  />
                  <label style={{ marginLeft: '.5rem' }}>
                    <input
                      type="checkbox"
                      checked={!!t.completa}
                      onChange={() => {
                        const nv = [...(form.tareas || [])]
                        nv[i] = { ...nv[i], completa: !nv[i].completa }
                        setForm({ ...form, tareas: nv })
                      }}
                    />
                    Completa
                  </label>
                </li>
              ))}
            </ul>

            <button className="btn" type="button" onClick={agregarTarea}>
              ➕ Añadir tarea
            </button>

            <div className="acciones">
              <button onClick={handleGuardar} className="primary" type="button">
                💾 Guardar
              </button>
              <button onClick={() => setModoEdicion(false)} className="ghost" type="button">
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              <strong>Patente:</strong> {arreglo.patente || '—'}
            </p>
            <p>
              <strong>Fecha:</strong> {arreglo.fecha || '—'}
            </p>
            <p>
              <strong>Hora entrada:</strong> {(arreglo as any).hora_entrada || '—'}
            </p>
            <p>
              <strong>Hora salida:</strong>{' '}
              {(arreglo as any).salida_indefinida ? 'Indefinido' : arreglo.hora_salida || '—'}
            </p>
            <p>
              <strong>Motivo:</strong> {arreglo.motivo || '—'}
            </p>
            <p>
              <strong>Prioridad:</strong> {String(arreglo.prioridad || 'baja')}
            </p>
            <p>
              <strong>Anotaciones:</strong> {arreglo.anotaciones || '—'}
            </p>

            <h3>Tareas</h3>
            <ul>
              {(arreglo.tareas || []).map((t, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" checked={!!t.completa} onChange={() => toggleTarea(i)} />
                    {t.texto}
                  </label>
                </li>
              ))}
            </ul>

            <div className="acciones">
              <button onClick={() => setModoEdicion(true)} className="primary" type="button">
                ✏️ Modificar arreglo
              </button>
              <button onClick={onCancel} className="ghost" type="button">
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
