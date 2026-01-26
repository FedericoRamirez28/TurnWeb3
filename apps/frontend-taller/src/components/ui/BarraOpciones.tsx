// src/components/ui/BarraOpciones.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Arreglo } from '@/lib/tallerTypes'
import { api } from '@/lib/api'

import ModalFormularioArreglo, { type NuevoArregloDto } from '@/components/modales/ModalFormularioArreglo'
import ModalArregloEditar, { type ArregloEditDto } from '@/components/modales/ModalArregloEditar'


type Props = {
  abierto: boolean
  onOpen: () => void
  onClose: () => void

  movilId?: string | number | null
  defaultPatente?: string

  arreglos?: Arreglo[]
  onAfterChange?: () => void

  onNuevoArreglo: (dto: NuevoArregloDto) => Promise<void> | void

  activarModoEliminar: () => void
  salirModoEliminar: () => void
  modoEliminar: boolean

  onFinalizarArreglos: () => void
  mostrarFinalizados: () => void
  verHistorialPorPatente: () => void
  verHistorialDelDia: () => void

  mostrarHamburguesa?: boolean
}

function mapToEditDto(a: Arreglo): ArregloEditDto {
  return {
    patente: (a.patente || '').toUpperCase(),
    fecha: a.fecha || '',
    motivo: a.motivo || '',
    anotaciones: a.anotaciones || '',
    prioridad: (String(a.prioridad || 'baja').toLowerCase() as any) || 'baja',
    hora_entrada: (a as any).hora_entrada || '',
    hora_salida: a.hora_salida || '',
    salida_indefinida: !!(a as any).salida_indefinida,
    tareas: Array.isArray((a as any).tareas) ? (a as any).tareas : [],
  }
}

export default function BarraOpciones({
  abierto,
  onOpen,
  onClose,

  movilId,
  defaultPatente = '',

  arreglos = [],
  onAfterChange = () => {},

  onNuevoArreglo,

  activarModoEliminar,
  salirModoEliminar,
  modoEliminar,

  onFinalizarArreglos,
  mostrarFinalizados,
  verHistorialPorPatente,
  verHistorialDelDia,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)

  // cerrar al click afuera
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuOpen) return
      const el = wrapRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  // modales
  const [openNuevo, setOpenNuevo] = useState(false)

  const [openPickEdit, setOpenPickEdit] = useState(false)
  const [editPickQuery, setEditPickQuery] = useState('')
  const [editTarget, setEditTarget] = useState<Arreglo | null>(null)

  const visibleArreglos = useMemo(() => {
    const q = editPickQuery.trim().toLowerCase()
    if (!q) return arreglos
    return arreglos.filter((a) => {
      const txt = `${a.patente || ''} ${a.fecha || ''} ${a.motivo || ''} ${a.anotaciones || ''}`.toLowerCase()
      return txt.includes(q)
    })
  }, [arreglos, editPickQuery])

  const handleToggleEliminar = () => {
    if (modoEliminar) salirModoEliminar()
    else activarModoEliminar()
    setMenuOpen(false)
  }

  const handleEditarGuardar = async (dto: ArregloEditDto) => {
    if (!editTarget) return

    const actualizado: any = {
      ...editTarget,
      ...dto,
      patente: dto.patente.toUpperCase().trim(),
      prioridad: String(dto.prioridad || 'baja').toLowerCase(),
      hora_entrada: dto.hora_entrada || null,
      hora_salida: dto.salida_indefinida ? null : dto.hora_salida || null,
      salida_indefinida: !!dto.salida_indefinida,
      tareas: Array.isArray(dto.tareas) ? dto.tareas : [],
      movil_id: (editTarget as any).movil_id ?? (movilId == null ? null : String(movilId)),
    }

    await api.put(`/arreglos/${encodeURIComponent(editTarget.id)}`, actualizado)

    // upsert historial día (si lo usás)
    await api.post('/historial-dia', {
      fecha: actualizado.fecha || null,
      movil_id: actualizado.movil_id ?? null,
      patente: (actualizado.patente || '').toUpperCase(),
      hora_entrada: actualizado.hora_entrada ?? null,
      hora_salida: actualizado.salida_indefinida ? null : actualizado.hora_salida ?? null,
      salida_indefinida: !!actualizado.salida_indefinida,
      anotaciones: actualizado.anotaciones ?? '',
      prioridad: String(actualizado.prioridad || 'baja').toLowerCase(),
      arreglo_id: actualizado.id,
      motivo: actualizado.motivo ?? null,
    })

    window.dispatchEvent(new Event('ts:historial-dia:refetch'))
    window.dispatchEvent(new CustomEvent('ts:calendar:refresh'))

    setEditTarget(null)
    await onAfterChange()
  }

  return (
    <div className="bo-wrap" ref={wrapRef}>
      {/* Si tu navbar ya maneja “abierto”, esto queda compatible */}
      <button
        className="bo-btn"
        type="button"
        onClick={() => {
          setMenuOpen((v) => !v)
          if (!menuOpen) onOpen()
          else onClose()
        }}
      >
        Filtros y acciones <span className="bo-caret">▾</span>
      </button>

      {menuOpen && (
        <div className="bo-menu">
          <div className="bo-section">
            <div className="bo-title">Arreglos</div>

            <button
              className="bo-item primary"
              type="button"
              onClick={() => {
                setOpenNuevo(true)
                setMenuOpen(false)
              }}
            >
              ➕ Añadir arreglo
            </button>

            <button
              className="bo-item"
              type="button"
              onClick={() => {
                setOpenPickEdit(true)
                setMenuOpen(false)
              }}
              disabled={!arreglos.length}
              title={!arreglos.length ? 'No hay arreglos para editar' : ''}
            >
              ✏️ Editar arreglo
            </button>

            <button className={`bo-item ${modoEliminar ? 'danger' : ''}`} type="button" onClick={handleToggleEliminar}>
              {modoEliminar ? '🧹 Salir de modo eliminar' : '🗑 Activar modo eliminar'}
            </button>
          </div>

          <div className="bo-sep" />

          <div className="bo-section">
            <div className="bo-title">Vistas</div>
            <button className="bo-item" type="button" onClick={() => (setMenuOpen(false), mostrarFinalizados())}>
              ✅ Ver arreglos finalizados
            </button>
            <button className="bo-item" type="button" onClick={() => (setMenuOpen(false), verHistorialPorPatente())}>
              🔎 Historial por patente
            </button>
            <button className="bo-item" type="button" onClick={() => (setMenuOpen(false), verHistorialDelDia())}>
              📅 Historial del día
            </button>
          </div>

          <div className="bo-sep" />

          <div className="bo-section">
            <div className="bo-title">Acciones</div>
            <button className="bo-item success" type="button" onClick={() => (setMenuOpen(false), onFinalizarArreglos())}>
              🏁 Finalizar arreglos (mover Done a Finalizados)
            </button>
          </div>
        </div>
      )}

      {/* ✅ Modal: Nuevo Arreglo */}
      {openNuevo && (
        <ModalFormularioArreglo
          movilId={movilId}
          defaultPatente={defaultPatente}
          onClose={() => setOpenNuevo(false)}
          onAgregar={async (dto) => {
            await onNuevoArreglo(dto)
            await onAfterChange()
          }}
        />
      )}

      {/* ✅ Modal: Selector para editar */}
      {openPickEdit && (
        <div className="modal-overlay" onClick={(e) => (e.target as HTMLElement).classList.contains('modal-overlay') && setOpenPickEdit(false)}>
          <div className="modal bo-pick">
            <h2>Elegí un arreglo para editar</h2>

            <input
              className="bo-pick-search"
              placeholder="Buscar por patente, fecha, motivo…"
              value={editPickQuery}
              onChange={(e) => setEditPickQuery(e.currentTarget.value)}
            />

            <div className="bo-pick-list">
              {visibleArreglos.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="bo-pick-item"
                  onClick={() => {
                    setEditTarget(a)
                    setOpenPickEdit(false)
                    setEditPickQuery('')
                  }}
                >
                  <div className="bo-pick-top">
                    <span className="tag">{(a.patente || '—').toUpperCase()}</span>
                    <span className="date">{a.fecha || ''}</span>
                  </div>
                  <div className="bo-pick-mid">{a.motivo || '—'}</div>
                  {a.anotaciones && <div className="bo-pick-sub">{a.anotaciones}</div>}
                </button>
              ))}

              {!visibleArreglos.length && <div className="bo-empty">No hay resultados</div>}
            </div>

            <div className="acciones">
              <button className="ghost" type="button" onClick={() => setOpenPickEdit(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal: Editar */}
      {editTarget && (
        <ModalArregloEditar
          initial={mapToEditDto(editTarget)}
          onClose={() => setEditTarget(null)}
          onSave={handleEditarGuardar}
        />
      )}
    </div>
  )
}
