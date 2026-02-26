// src/screens/VerFinalizadosScreen.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

import { api } from '@/lib/api'
import { useMovilId } from '@/screens/useMovilId'

type Tarea = { texto: string; completa?: boolean }

type FinalizadoUI = {
  id: string
  movilNumero?: number | null
  patente: string
  fecha: string
  anotaciones: string
  prioridad?: 'baja' | 'alta' | 'urgente' | string | null
  tareas: Tarea[]
}

/** Soporta varios shapes posibles del backend */
type FinalizadoApiItem =
  | {
      id: string
      movilId?: string | null
      movilNumero?: number | null
      movil?: { numero?: number | null } | null
      payload?: any
      createdAt?: string
    }
  | any

const todayISO = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function asNum(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function stripAccents(s: string) {
  try {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  } catch {
    return s
  }
}

function normText(x: unknown) {
  return stripAccents(String(x ?? '')).toLowerCase().trim()
}

function normalizeFinalizado(raw: FinalizadoApiItem, fallbackMovilId?: string | number | null): FinalizadoUI | null {
  const payload = raw?.payload ?? raw

  const patente =
    String(payload?.patente ?? payload?.patenteSnap ?? payload?.patente_fija ?? payload?.patenteFija ?? '').trim()

  const fecha =
    String(payload?.fecha ?? payload?.fechaISO ?? payload?.fecha_iso ?? payload?.createdAt ?? raw?.createdAt ?? '').trim()

  const anotaciones = String(payload?.anotaciones ?? payload?.nota ?? '').trim()

  const prioridad = payload?.prioridad ?? payload?.priority ?? null

  const tareasRaw = payload?.tareas ?? payload?.tasks ?? []
  const tareas: Tarea[] = Array.isArray(tareasRaw)
    ? tareasRaw
        .map((t: any) => ({
          texto: String(t?.texto ?? t?.text ?? '').trim(),
          completa: !!(t?.completa ?? t?.done ?? t?.completed),
        }))
        .filter((t: Tarea) => t.texto.length > 0)
    : []

  const movilNumero =
    asNum(raw?.movilNumero) ??
    asNum(raw?.movil?.numero) ??
    asNum(payload?.movilNumero) ??
    asNum(payload?.movil_id) ??
    asNum(payload?.movilId) ??
    asNum(fallbackMovilId)

  if (!patente && !fecha && !anotaciones && tareas.length === 0) return null

  return {
    id: String(raw?.id ?? payload?.id ?? crypto.randomUUID()),
    movilNumero,
    patente: patente || '—',
    fecha: fecha || '—',
    anotaciones: anotaciones || '—',
    prioridad,
    tareas,
  }
}

function fechaFileISO() {
  // Nombre de archivo simple con fecha actual
  return todayISO()
}

export default function VerFinalizadosScreen() {
  const nav = useNavigate()
  const movilId = useMovilId() // puede ser null si estás en vista global
  const [finalizados, setFinalizados] = useState<FinalizadoUI[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    let abort = false
    setCargando(true)

    ;(async () => {
      try {
        // ✅ tu wrapper soporta query como 2do parámetro
        const j = await api.get<FinalizadoApiItem[]>('/finalizados', movilId ? { movilId } : undefined)
        if (abort) return

        if ((j as any)?.ok === true) {
          const list = Array.isArray((j as any).data) ? (j as any).data : []
          const normalized = list
            .map((it: any) => normalizeFinalizado(it, movilId ?? null))
            .filter(Boolean) as FinalizadoUI[]
          setFinalizados(normalized)
        } else if (Array.isArray(j as any)) {
          // por si tu wrapper devuelve array directo
          const list = Array.isArray(j) ? (j as any) : []
          const normalized = list
            .map((it: any) => normalizeFinalizado(it, movilId ?? null))
            .filter(Boolean) as FinalizadoUI[]
          setFinalizados(normalized)
        } else {
          // fallback
          const list = Array.isArray((j as any)?.data) ? (j as any).data : []
          const normalized = list
            .map((it: any) => normalizeFinalizado(it, movilId ?? null))
            .filter(Boolean) as FinalizadoUI[]
          setFinalizados(normalized)
        }
      } catch (e) {
        if (!abort) {
          console.error('Error cargando finalizados:', e)
          setFinalizados([])
        }
      } finally {
        if (!abort) setCargando(false)
      }
    })()

    return () => {
      abort = true
    }
  }, [movilId])

  const filtered = useMemo(() => {
    const s = normText(q)
    if (!s) return finalizados

    return finalizados.filter((a) => {
      const txt = normText(
        `${a.movilNumero ?? ''} ${a.patente} ${a.fecha} ${a.prioridad ?? ''} ${a.anotaciones} ${(a.tareas || [])
          .map((t) => t.texto)
          .join(' ')}`,
      )
      return txt.includes(s)
    })
  }, [finalizados, q])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      // global: orden por móvil primero, luego fecha
      const am = String(a.movilNumero ?? '')
      const bm = String(b.movilNumero ?? '')
      if (!movilId && am !== bm) return am.localeCompare(bm)
      return String(a.fecha ?? '').localeCompare(String(b.fecha ?? ''))
    })
    return copy
  }, [filtered, movilId])

  const exportarExcel = () => {
    const datos = sorted.map((a) => ({
      Movil: a.movilNumero ?? '',
      Patente: a.patente,
      Fecha: a.fecha,
      Prioridad: a.prioridad ?? '',
      Anotaciones: a.anotaciones,
      Tareas: (a.tareas || []).map((t) => t.texto).join(', '),
    }))
    const hoja = XLSX.utils.json_to_sheet(datos)
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, hoja, 'Finalizados')

    const suf = movilId ? `movil-${movilId}` : 'global'
    XLSX.writeFile(libro, `arreglos-finalizados_${suf}_${fechaFileISO()}.xlsx`)
  }

  const exportarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
    const title = movilId ? `Arreglos finalizados — Móvil ${movilId}` : 'Arreglos finalizados — Todos los móviles'
    doc.setFontSize(14)
    doc.text(`${title} — ${fechaFileISO()}`, 40, 36)

    const head = movilId
      ? [['Patente', 'Fecha', 'Prioridad', 'Anotaciones', 'Tareas']]
      : [['Móvil', 'Patente', 'Fecha', 'Prioridad', 'Anotaciones', 'Tareas']]

    const body = sorted.map((a) => {
      const base = [
        a.patente || '-',
        a.fecha || '-',
        String(a.prioridad ?? '').toUpperCase(),
        a.anotaciones || '',
        (a.tareas || []).map((t) => t.texto).join(', '),
      ]
      return movilId ? base : [String(a.movilNumero ?? '-'), ...base]
    })

    autoTable(doc, {
      head,
      body,
      startY: 56,
      styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
      headStyles: { fillColor: [0, 143, 107] },
      theme: 'striped',
    })

    const suf = movilId ? `movil-${movilId}` : 'global'
    doc.save(`arreglos-finalizados_${suf}_${fechaFileISO()}.pdf`)
  }

  const title = movilId ? `Arreglos finalizados — Móvil ${movilId}` : 'Arreglos finalizados — Todos los móviles'

  return (
    <div className="ver-finalizados">
      <header className="hd-header">
        <div className="hd-left">
          <button className="btn btn--outline" onClick={() => nav(movilId ? `/movil/${movilId}` : `/`)} type="button">
            Volver
          </button>
          <div className="hd-titlewrap">
            <h1 className="hd-title">Arreglos finalizados</h1>
            <div className="hd-subtitle">{movilId ? `Móvil ${movilId}` : 'Todos los móviles'}</div>
          </div>
        </div>

        <div className="hd-right">
          <input
            className="input hd-search"
            placeholder={
              movilId
                ? 'Buscar (patente, fecha, prioridad, observaciones, tareas)'
                : 'Buscar (móvil, patente, fecha, prioridad, observaciones, tareas)'
            }
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            spellCheck={false}
          />

          <div className="hd-actions">
            <button className="btn btn--primary" onClick={exportarPDF} type="button">
              ⬇️ PDF
            </button>
            <button className="btn btn--primary" onClick={exportarExcel} type="button">
              ⬇️ Excel
            </button>
          </div>
        </div>
      </header>

      {cargando ? (
        <div className="vf-card vf-empty">
          <div className="vf-muted">Cargando…</div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="vf-card vf-empty">
          <div className="vf-muted">No hay resultados{q ? ` para “${q}”` : ''}.</div>
        </div>
      ) : (
        <div className="vf-grid">
          {sorted.map((a) => (
            <article key={a.id} className="vf-item vf-card">
              <header className="vf-item__head">
                <div className="vf-item__left">
                  <div className="vf-patente">{a.patente}</div>
                  <div className="vf-meta">
                    {a.movilNumero != null && <span className="vf-chip">Móvil {a.movilNumero}</span>}
                    <span className="vf-date">Fecha: {a.fecha}</span>
                    {String(a.prioridad ?? '').toLowerCase() === 'baja' && <span className="vf-prio vf-prio--baja">baja</span>}
                    {String(a.prioridad ?? '').toLowerCase() === 'alta' && <span className="vf-prio vf-prio--alta">alta</span>}
                    {String(a.prioridad ?? '').toLowerCase() === 'urgente' && (
                      <span className="vf-prio vf-prio--urgente">urgente</span>
                    )}
                  </div>
                </div>
              </header>

              <div className="vf-anot">
                <span className="vf-label">Anotaciones</span>
                <div className="vf-anot__text">{a.anotaciones}</div>
              </div>

              <div className="vf-tareas">
                <div className="vf-label">Arreglos realizados</div>
                <ul className="vf-tareas__list">
                  {(a.tareas || []).map((t, i) => (
                    <li key={`${a.id}-t-${i}`} className="vf-tarea">
                      <span className="vf-check">✓</span>
                      <span className="vf-txt">{t.texto}</span>
                    </li>
                  ))}
                  {(a.tareas || []).length === 0 && <li className="vf-muted">Sin tareas guardadas.</li>}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
