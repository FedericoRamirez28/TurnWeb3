import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { api } from '@/lib/api'
import type { ApiResult } from '@/lib/types'

type Params = { movilId?: string }

type ResumenItem = {
  patente: string
  movil_id?: number | null
  veces: number
  ultima_fecha?: string | null
  pr_baja?: number
  pr_alta?: number
  pr_urgente?: number
}

const BA_TIME_ZONE = 'America/Argentina/Buenos_Aires'
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME_NO_TZ_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/

function parseDateForSort(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return Number.NEGATIVE_INFINITY

  if (DATE_ONLY_RE.test(raw)) {
    return Date.parse(`${raw}T00:00:00-03:00`)
  }

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

export default function HistorialPatentesScreen() {
  const nav = useNavigate()
  const { movilId: movilIdParam } = useParams<Params>()
  const [params] = useSearchParams()

  const movilId = (movilIdParam?.trim() || params.get('movilId')?.trim() || '') || ''

  const [items, setItems] = useState<ResumenItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    let abort = false
    setCargando(true)

    ;(async () => {
      try {
        const url = movilId ? `/historial?movilId=${encodeURIComponent(movilId)}` : `/historial`
        const r = await api.get<ApiResult<ResumenItem[]>>(url)

        if (abort) return

        if (r.ok) setItems(r.data ?? [])
        else {
          console.error('Error cargando historial:', r.error)
          setItems([])
        }
      } catch (e) {
        if (!abort) {
          console.error('Error cargando historial:', e)
          setItems([])
        }
      } finally {
        if (!abort) setCargando(false)
      }
    })()

    return () => {
      abort = true
    }
  }, [movilId])

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return items

    return items.filter((it) =>
      `${it.patente} ${it.movil_id ?? ''} ${it.ultima_fecha ?? ''} ${formatBuenosAires(it.ultima_fecha)}`
        .toLowerCase()
        .includes(term),
    )
  }, [items, q])

  const ordenados = useMemo(() => {
    const copy = [...filtrados]
    copy.sort((a, b) => {
      const diff = parseDateForSort(b.ultima_fecha) - parseDateForSort(a.ultima_fecha)
      if (diff !== 0) return diff

      const vecesDiff = Number(b.veces ?? 0) - Number(a.veces ?? 0)
      if (vecesDiff !== 0) return vecesDiff

      return String(a.patente ?? '').localeCompare(String(b.patente ?? ''))
    })
    return copy
  }, [filtrados])

  const exportarPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Historial por patente ${movilId ? `(Móvil #${movilId})` : ''}`, 14, 16)

    const body = ordenados.map((x) => [
      x.patente,
      x.movil_id ?? '',
      x.veces ?? 0,
      formatBuenosAires(x.ultima_fecha),
      x.pr_baja || 0,
      x.pr_alta || 0,
      x.pr_urgente || 0,
    ])

    autoTable(doc, {
      head: [['Patente', 'Móvil', 'Ingresos', 'Último', 'Baja', 'Alta', 'Urgente']],
      body,
      startY: 28,
    })

    doc.save(`historial_${movilId || 'global'}.pdf`)
  }

  return (
    <div className="historial-patentes">
      <header className="hp-header">
        <div className="hp-left">
          <button className="btn btn--outline" onClick={() => nav(movilId ? `/movil/${movilId}` : `/`)} type="button">
            Volver
          </button>

          <div className="hp-titlewrap">
            <h1 className="hp-title">Historial por patente</h1>
            <div className="hp-subtitle">{movilId ? `Móvil ${movilId}` : 'Todos los móviles'}</div>
          </div>
        </div>

        <div className="hp-right">
          <input
            className="input hp-search"
            placeholder="Buscar (patente o móvil)"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />

          <div className="hp-actions">
            <button className="btn btn--primary" onClick={exportarPDF} type="button" disabled={cargando}>
              🗂 Exportar PDF
            </button>
          </div>
        </div>
      </header>

      {cargando ? (
        <div className="hp-card hp-muted">Cargando…</div>
      ) : ordenados.length === 0 ? (
        <div className="hp-card hp-muted">No hay resultados.</div>
      ) : (
        <div className="hp-grid">
          {ordenados.map((it) => (
            <article className="hp-card" key={`${it.patente}-${it.movil_id ?? 'global'}`}>
              <header className="hp-card__head">
                <div className="hp-patente">{it.patente}</div>
                {!!it.movil_id && <div className="hp-movil">Móvil #{it.movil_id}</div>}
              </header>

              <dl className="hp-stats">
                <div>
                  <dt>Ingresos</dt>
                  <dd>{it.veces ?? 0}</dd>
                </div>

                <div>
                  <dt>Último ingreso</dt>
                  <dd>{formatBuenosAires(it.ultima_fecha)}</dd>
                </div>

                <div className="full">
                  <dt>Prioridades</dt>
                  <dd className="hp-prioridades">
                    <span className="hp-chip hp-chip--baja">🟢 {it.pr_baja || 0}</span>
                    <span className="hp-chip hp-chip--alta">🟡 {it.pr_alta || 0}</span>
                    <span className="hp-chip hp-chip--urgente">🔴 {it.pr_urgente || 0}</span>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
