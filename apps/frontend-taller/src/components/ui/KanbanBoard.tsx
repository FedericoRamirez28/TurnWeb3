import React, { useEffect, useMemo, useRef, useState } from 'react'

import ModalArregloDetalle from '../modales/ModalArregloDetalle'
import type { ColKey, Tarea, Arreglo, Tablero } from '@/lib/tallerTypes'

const COLS: ColKey[] = ['Inbox', 'In progress', 'Done']
const COL_LABEL: Record<ColKey, string> = {
  Inbox: 'En espera',
  'In progress': 'En progreso',
  Done: 'Finalizado',
}

function nowLocal(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

type Props = {
  movilId?: string | number | null
  tablero: Tablero
  setTablero: React.Dispatch<React.SetStateAction<Tablero>>
  filtro?: string
  modoEliminar?: boolean
  salirModoEliminar?: () => void
}

export default function KanbanBoard({
  movilId,
  tablero,
  setTablero,
  filtro = '',
  modoEliminar = false,
  salirModoEliminar = () => {},
}: Props) {
  const API_BASE =
    (import.meta as any)?.env?.VITE_TALLER_API_BASE_URL ||
    (import.meta as any)?.env?.VITE_API_BASE ||
    (typeof window !== 'undefined' && (window as any).env?.API_BASE) ||
    'http://localhost:3003'

  const [detalleOpen, setDetalleOpen] = useState(false)
  const [detalleItem, setDetalleItem] = useState<Arreglo | null>(null)

  const inboxRef = useRef<HTMLDivElement>(null)
  const inProgRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)

  const colRefs: Record<ColKey, React.RefObject<HTMLDivElement>> = {
    Inbox: inboxRef,
    'In progress': inProgRef,
    Done: doneRef,
  }

  // ======== Filtro ========
  const filtroNorm = String(filtro || '').toLowerCase()
  const filtrado = useMemo<Tablero>(() => {
    if (!filtroNorm) return tablero
    const out: Tablero = { Inbox: [], 'In progress': [], Done: [] }

    for (const col of COLS) {
      out[col] = (tablero[col] || []).filter((a) => {
        const txt = [
          a?.patente,
          a?.motivo,
          a?.anotaciones,
          ...(Array.isArray(a?.tareas) ? a.tareas.map((t) => t?.texto) : []),
          a?.prioridad,
        ]
          .join(' ')
          .toLowerCase()
        return txt.includes(filtroNorm)
      })
    }
    return out
  }, [tablero, filtroNorm])

  // ======== REST ========
  async function putArreglo(a: Arreglo) {
    try {
      const res = await fetch(`${API_BASE}/arreglos/${encodeURIComponent(a.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    } catch (e) {
      console.error('PUT /arreglos/:id', e)
      alert('No se pudo actualizar el arreglo')
      return false
    }
  }

  async function deleteArreglo(id: string) {
    try {
      const res = await fetch(`${API_BASE}/arreglos/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return true
    } catch (e) {
      console.error('DELETE /arreglos/:id', e)
      alert('No se pudo eliminar el arreglo')
      return false
    }
  }

  async function updateHistorialSalida(
    arregloId: string,
    { hora_salida = null, salida_indefinida = 0 }: { hora_salida?: string | null; salida_indefinida?: number },
  ) {
    try {
      const res = await fetch(`${API_BASE}/historial-dia/update-by-arreglo-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arreglo_id: arregloId, hora_salida, salida_indefinida }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      window.dispatchEvent(new CustomEvent('ts:historial-dia:refetch'))
    } catch (e) {
      console.warn('PUT /historial-dia/update-by-arreglo-id', e)
    }
  }

  const setColState = (next: Partial<Tablero>) => setTablero((prev) => ({ ...prev, ...next }))
  const removeFrom = (col: ColKey, id: string) => (tablero[col] || []).filter((a) => a.id !== id)

  function openDetalle(a: Arreglo) {
    setDetalleItem(a)
    setDetalleOpen(true)
    ;(window as any).__ts_last_arreglo = a // ✅ para "Editar arreglo" del navbar
  }

  // ✅ abrir detalle por evento desde TopNavbar (editar último)
  useEffect(() => {
    const onOpen = (e: any) => {
      const arregloId = String(e?.detail?.arregloId || '')
      if (!arregloId) return
      const all = [...(tablero.Inbox || []), ...(tablero['In progress'] || []), ...(tablero.Done || [])]
      const found = all.find((x) => String(x.id) === arregloId)
      if (found) openDetalle(found)
    }
    window.addEventListener('ts:kanban:open-detalle', onOpen)
    return () => window.removeEventListener('ts:kanban:open-detalle', onOpen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablero.Inbox.length, tablero['In progress'].length, tablero.Done.length])

  // persistencia de movimientos
  async function persistMove(a: Arreglo, from: ColKey, to: ColKey) {
    const payload: Arreglo = { ...a, tareas: Array.isArray(a.tareas) ? a.tareas.map((t) => ({ ...t })) : [] }

    if (to === 'Inbox') {
      payload.tareas = (payload.tareas || []).map((t) => ({ ...t, completa: false }))
      payload.hora_salida = null
      payload.salida_indefinida = 0 as any
    } else if (to === 'In progress') {
      const tareas = payload.tareas || []
      if (!tareas.some((t) => t.completa)) {
        const idx = tareas.findIndex((t) => !t.completa)
        if (idx >= 0) tareas[idx].completa = true
        else if (tareas.length) tareas[0].completa = true
      }
      payload.tareas = tareas
    } else if (to === 'Done') {
      payload.tareas = (payload.tareas || []).map((t) => ({ ...t, completa: true }))
      const indef = !!(payload as any).salida_indefinida
      if (!indef && !payload.hora_salida) payload.hora_salida = nowLocal()
    }

    const ok = await putArreglo(payload)
    if (!ok) return

    const nextFrom = removeFrom(from, payload.id)
    const nextTo = [payload, ...(tablero[to] || [])]
    setColState({ [from]: nextFrom, [to]: nextTo } as Partial<Tablero>)

    if (to === 'Done') {
      await updateHistorialSalida(payload.id, {
        salida_indefinida: (payload as any).salida_indefinida ? 1 : 0,
        hora_salida: (payload as any).salida_indefinida ? null : payload.hora_salida || null,
      })
    } else if (from === 'Done') {
      await updateHistorialSalida(payload.id, { salida_indefinida: 0, hora_salida: null })
    }

    window.dispatchEvent(new CustomEvent('ts:calendar:refresh'))
  }

  async function moveLeft(a: Arreglo, from: ColKey) {
    const to: ColKey = from === 'Done' ? 'In progress' : 'Inbox'
    await persistMove(a, from, to)
  }

  async function moveRight(a: Arreglo, from: ColKey) {
    const to: ColKey = from === 'Inbox' ? 'In progress' : 'Done'
    await persistMove(a, from, to)
  }

  async function handleSaveDesdeModal(actualizado: Arreglo, nuevasTareas: Tarea[], moverADone: boolean) {
    const payload: Arreglo = { ...actualizado, tareas: nuevasTareas }
    if (moverADone && !(payload as any).salida_indefinida && !payload.hora_salida) payload.hora_salida = nowLocal()

    const ok = await putArreglo(payload)
    if (!ok) return

    const inInbox = (tablero.Inbox || []).some((x) => x.id === payload.id)
    const inProg = (tablero['In progress'] || []).some((x) => x.id === payload.id)
    const from: ColKey = inInbox ? 'Inbox' : inProg ? 'In progress' : 'Done'
    const to: ColKey = moverADone ? 'Done' : from

    const nextFrom = removeFrom(from, payload.id)
    const nextTo = [payload, ...(tablero[to] || [])]
    setColState({ [from]: nextFrom, [to]: nextTo } as Partial<Tablero>)

    await updateHistorialSalida(payload.id, {
      salida_indefinida: (payload as any).salida_indefinida ? 1 : 0,
      hora_salida: (payload as any).salida_indefinida ? null : payload.hora_salida || (moverADone ? nowLocal() : null),
    })

    window.dispatchEvent(new CustomEvent('ts:calendar:refresh'))
    setDetalleOpen(false)
    ;(window as any).__ts_last_arreglo = payload
  }

  // ======== Drag (SortableJS) ========
  useEffect(() => {
    let sortables: any[] = []

    ;(async () => {
      let Sortable: any
      try {
        Sortable = (await import('sortablejs')).default
      } catch {
        Sortable = null
      }
      if (!Sortable) return

      for (const col of COLS) {
        const el = colRefs[col]?.current
        if (!el) continue

        const s = Sortable.create(el, {
          group: 'kanban-arreglos',
          animation: 150,
          handle: '.kb-card',
          onAdd: async (evt: any) => {
            const id = String(evt.item?.dataset?.id || '')
            const from = evt.from?.dataset?.col as ColKey | undefined
            const to = evt.to?.dataset?.col as ColKey | undefined
            if (!id || !from || !to) return

            const item =
              (tablero[from] || []).find((x) => String(x.id) === id) ||
              [...tablero.Inbox, ...tablero['In progress'], ...tablero.Done].find((x) => String(x.id) === id)

            if (item) await persistMove(item, from, to)
          },
        })

        sortables.push(s)
      }
    })()

    return () => {
      try {
        sortables.forEach((s) => s?.destroy?.())
      } catch {
        // noop
      }
      sortables = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablero.Inbox.length, tablero['In progress'].length, tablero.Done.length])

  return (
    <div className={'kb-wrap' + (modoEliminar ? ' modo-eliminar' : '')}>
      {modoEliminar && (
        <div className="kb-banner">
          <strong>Modo eliminar</strong> — hacé clic en la ❌ de la tarjeta para eliminar
          <button className="kb-exit" onClick={salirModoEliminar} type="button">
            Salir
          </button>
        </div>
      )}

      <div className="kb-grid">
        {COLS.map((col) => (
          <section key={col} className="kb-col">
            <header className="kb-colhead">
              <h3>{COL_LABEL[col]}</h3>
              <span className="kb-count">{(filtrado[col] || []).length}</span>
            </header>

            <div className="kb-list" ref={colRefs[col]} data-col={col}>
              {(filtrado[col] || []).map((a) => (
                <article
                  key={a.id}
                  className={`kb-card prio-${String(a.prioridad || 'baja').toLowerCase()}`}
                  data-id={a.id}
                  onClick={() => ((window as any).__ts_last_arreglo = a)}
                  onDoubleClick={() => openDetalle(a)}
                >
                  <div className="kb-line">
                    <span className="kb-tag">{a.patente || '—'}</span>
                    <span className="kb-date">{a.fecha || ''}</span>
                  </div>

                  {a.motivo && <div className="kb-motivo">📌 {a.motivo}</div>}
                  {a.anotaciones && <div className="kb-note">{a.anotaciones}</div>}

                  {Array.isArray(a.tareas) && a.tareas.length > 0 && (
                    <div className="kb-tasks">
                      {a.tareas.slice(0, 3).map((t, i) => (
                        <div key={String((t as any).id || i)} className={`kb-task ${t.completa ? 'done' : ''}`}>
                          {t.completa ? '✔' : '•'} {t.texto}
                        </div>
                      ))}
                      {a.tareas.length > 3 && <div className="kb-more">+{a.tareas.length - 3} tareas…</div>}
                    </div>
                  )}

                  <div className="kb-actions">
                    <div className="kb-left">
                      {col !== 'Inbox' && (
                        <button title="Mover a la izquierda" onClick={() => moveLeft(a, col)} type="button">
                          ←
                        </button>
                      )}
                      {col !== 'Done' && (
                        <button title="Mover a la derecha" onClick={() => moveRight(a, col)} type="button">
                          →
                        </button>
                      )}
                      <button
                        title="Editar"
                        onClick={() => openDetalle(a)}
                        type="button"
                      >
                        ✏️
                      </button>
                    </div>

                    <div className="kb-right">
                      {modoEliminar && (
                        <button
                          className="kb-del"
                          title="Eliminar"
                          type="button"
                          onClick={async () => {
                            const ok = window.confirm('¿Eliminar arreglo?')
                            if (!ok) return

                            const done = await deleteArreglo(a.id)
                            if (!done) return

                            const upd: Partial<Tablero> = {}
                            for (const c of COLS) upd[c] = removeFrom(c, a.id)
                            setColState(upd)

                            await updateHistorialSalida(a.id, { salida_indefinida: 0, hora_salida: null })
                            window.dispatchEvent(new CustomEvent('ts:calendar:refresh'))
                          }}
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {detalleOpen && detalleItem && (
        <ModalArregloDetalle
          arreglo={detalleItem}
          onSave={handleSaveDesdeModal}
          onCancel={() => setDetalleOpen(false)}
        />
      )}
    </div>
  )
}
