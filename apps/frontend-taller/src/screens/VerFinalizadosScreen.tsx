import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

import { api } from '@/lib/api'
import { useMovilId } from '@/screens/useMovilId'

type Tarea = { texto: string; completa?: boolean }

type ParteResumen = {
  chofer: string
  observaciones: string
}

type FinalizadoUI = {
  id: string
  movilNumero?: number | null
  movilLookupId?: string | null
  patente: string
  fecha: string
  anotaciones: string
  observacionesChofer: string
  chofer: string
  prioridad?: 'baja' | 'alta' | 'urgente' | string | null
  tareas: Tarea[]
  horaInicio: string | null
  horaFinalizado: string | null
}

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

const BA_TIME_ZONE = 'America/Argentina/Buenos_Aires'
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME_NO_TZ_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/

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

function pickText(...values: unknown[]): string {
  for (const value of values) {
    const s = String(value ?? '').trim()
    if (s) return s
  }
  return ''
}

function parseDateForSort(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return Number.NEGATIVE_INFINITY

  if (DATE_ONLY_RE.test(raw)) return Date.parse(`${raw}T00:00:00-03:00`)

  if (DATE_TIME_NO_TZ_RE.test(raw)) {
    const normalized = raw.replace(' ', 'T')
    const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized
    return Date.parse(`${withSeconds}-03:00`)
  }

  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function formatBuenosAires(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'

  if (DATE_ONLY_RE.test(raw)) {
    const [y, m, d] = raw.split('-')
    return `${d}/${m}/${y}`
  }

  if (DATE_TIME_NO_TZ_RE.test(raw)) {
    const normalized = raw.replace(' ', 'T')
    const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized
    const parsed = new Date(`${withSeconds}-03:00`)
    if (Number.isNaN(parsed.getTime())) return raw

    return new Intl.DateTimeFormat('es-AR', {
      timeZone: BA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(parsed)
      .replace(',', '')
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw

  const hasTime = /T\d{2}:\d{2}|\s\d{2}:\d{2}/.test(raw)
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: BA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(hasTime
      ? {
          hour: '2-digit' as const,
          minute: '2-digit' as const,
          hour12: false,
        }
      : {}),
  })
    .format(parsed)
    .replace(',', '')
}

function formatHourOnly(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'

  const hhmm = raw.match(/(\d{2}:\d{2})/)
  if (hhmm) return hhmm[1]

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: BA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}

function normalizeFinalizado(raw: FinalizadoApiItem, fallbackMovilId?: string | number | null): FinalizadoUI | null {
  const payload = raw?.payload ?? raw

  const patente = pickText(payload?.patente, payload?.patenteSnap, payload?.patente_fija, payload?.patenteFija)
  const fecha = pickText(payload?.fecha, payload?.fechaISO, payload?.fecha_iso, payload?.archivedAt, payload?.finalizedAt, payload?.createdAt, raw?.createdAt)
  const anotaciones = pickText(payload?.anotaciones, payload?.nota)
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

  const movilLookupId = pickText(raw?.movilId, payload?.movilId, payload?.movil_id, movilNumero, fallbackMovilId) || null
  const horaInicio = pickText(payload?.hora_entrada, payload?.horaEntrada) || null
  const horaFinalizado =
    pickText(payload?.hora_salida, payload?.horaSalida, payload?.archivedAt, payload?.finalizedAt, raw?.createdAt) || null
  const observacionesChofer = pickText(payload?.observacionesChofer, payload?.parteDiarioObservaciones, payload?.obsChofer)
  const chofer = pickText(payload?.choferParte, payload?.chofer)

  if (!patente && !fecha && !anotaciones && tareas.length === 0) return null

  return {
    id: String(raw?.id ?? payload?.id ?? crypto.randomUUID()),
    movilNumero,
    movilLookupId,
    patente: patente || '—',
    fecha: fecha || '—',
    anotaciones: anotaciones || '—',
    observacionesChofer: observacionesChofer || '',
    chofer: chofer || '',
    prioridad,
    tareas,
    horaInicio,
    horaFinalizado,
  }
}

function fechaFileISO() {
  return todayISO()
}

export default function VerFinalizadosScreen() {
  const nav = useNavigate()
  const movilId = useMovilId()
  const [finalizados, setFinalizados] = useState<FinalizadoUI[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [parteMap, setParteMap] = useState<Record<string, ParteResumen>>({})

  useEffect(() => {
    let abort = false
    setCargando(true)

    ;(async () => {
      try {
        const j = await api.get<FinalizadoApiItem[]>('/finalizados', movilId ? { movilId } : undefined)
        if (abort) return

        const list =
          (j as any)?.ok === true
            ? Array.isArray((j as any).data)
              ? (j as any).data
              : []
            : Array.isArray(j as any)
              ? (j as any)
              : Array.isArray((j as any)?.data)
                ? (j as any).data
                : []

        const normalized = list
          .map((it: any) => normalizeFinalizado(it, movilId ?? null))
          .filter(Boolean) as FinalizadoUI[]

        setFinalizados(normalized)
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

  useEffect(() => {
    const uniqueIds = Array.from(
      new Set(
        finalizados
          .map((item) => String(item.movilLookupId ?? '').trim())
          .filter(Boolean),
      ),
    )

    if (!uniqueIds.length) {
      setParteMap({})
      return
    }

    let abort = false

    ;(async () => {
      const entries = await Promise.all(
        uniqueIds.map(async (id) => {
          try {
            const r = await api.get<any>(`/moviles/${encodeURIComponent(id)}/parte-diario/ultimo`)
            if (!r.ok) return [id, { chofer: '', observaciones: '' }] as const

            const data = (r as any)?.data ?? r
            return [
              id,
              {
                chofer: pickText(data?.chofer),
                observaciones: pickText(data?.observaciones),
              },
            ] as const
          } catch {
            return [id, { chofer: '', observaciones: '' }] as const
          }
        }),
      )

      if (!abort) setParteMap(Object.fromEntries(entries))
    })()

    return () => {
      abort = true
    }
  }, [finalizados])

  const merged = useMemo(() => {
    return finalizados.map((item) => {
      const key = String(item.movilLookupId ?? '').trim()
      const parte = key ? parteMap[key] : undefined

      return {
        ...item,
        chofer: item.chofer || parte?.chofer || '',
        observacionesChofer: item.observacionesChofer || parte?.observaciones || '',
      }
    })
  }, [finalizados, parteMap])

  const filtered = useMemo(() => {
    const s = normText(q)
    if (!s) return merged

    return merged.filter((a) => {
      const txt = normText(
        `${a.movilNumero ?? ''} ${a.patente} ${a.fecha} ${formatBuenosAires(a.fecha)} ${a.prioridad ?? ''} ${a.anotaciones} ${a.observacionesChofer} ${a.chofer} ${formatHourOnly(a.horaInicio)} ${formatHourOnly(a.horaFinalizado)} ${(a.tareas || [])
          .map((t) => t.texto)
          .join(' ')}`,
      )
      return txt.includes(s)
    })
  }, [merged, q])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      const diff = parseDateForSort(b.horaFinalizado || b.fecha) - parseDateForSort(a.horaFinalizado || a.fecha)
      if (diff !== 0) return diff

      const bm = Number(b.movilNumero ?? -1)
      const am = Number(a.movilNumero ?? -1)
      if (bm !== am) return bm - am

      return String(a.patente ?? '').localeCompare(String(b.patente ?? ''))
    })
    return copy
  }, [filtered])

  const exportarExcel = () => {
    const datos = sorted.map((a) => ({
      Movil: a.movilNumero ?? '',
      Patente: a.patente,
      Fecha: formatBuenosAires(a.fecha),
      'Hora inicio': formatHourOnly(a.horaInicio),
      'Hora finalizado': formatHourOnly(a.horaFinalizado),
      Prioridad: a.prioridad ?? '',
      'Obs. chofer': a.observacionesChofer || '',
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
      ? [['Patente', 'Fecha', 'Hora inicio', 'Hora finalizado', 'Prioridad', 'Obs. chofer', 'Anotaciones', 'Tareas']]
      : [['Móvil', 'Patente', 'Fecha', 'Hora inicio', 'Hora finalizado', 'Prioridad', 'Obs. chofer', 'Anotaciones', 'Tareas']]

    const body = sorted.map((a) => {
      const base = [
        a.patente || '-',
        formatBuenosAires(a.fecha),
        formatHourOnly(a.horaInicio),
        formatHourOnly(a.horaFinalizado),
        String(a.prioridad ?? '').toUpperCase(),
        a.observacionesChofer || '',
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
                    <span className="vf-date">Fecha: {formatBuenosAires(a.fecha)}</span>
                    {String(a.prioridad ?? '').toLowerCase() === 'baja' && <span className="vf-prio vf-prio--baja">baja</span>}
                    {String(a.prioridad ?? '').toLowerCase() === 'alta' && <span className="vf-prio vf-prio--alta">alta</span>}
                    {String(a.prioridad ?? '').toLowerCase() === 'urgente' && <span className="vf-prio vf-prio--urgente">urgente</span>}
                  </div>
                </div>
              </header>

              <div className="vf-extra-grid">
                <div className="vf-info-box">
                  <span className="vf-label">Hora inicio</span>
                  <div className="vf-info-value">{formatHourOnly(a.horaInicio)}</div>
                </div>
                <div className="vf-info-box">
                  <span className="vf-label">Hora finalizado</span>
                  <div className="vf-info-value">{formatHourOnly(a.horaFinalizado)}</div>
                </div>
              </div>

              <div className="vf-anot">
                <span className="vf-label">Obs. chofer</span>
                <div className="vf-anot__text">{a.observacionesChofer || 'Sin observaciones del chofer.'}</div>
              </div>

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
