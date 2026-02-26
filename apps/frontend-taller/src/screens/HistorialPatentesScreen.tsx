// src/screens/HistorialPatentesScreen.tsx
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
        const r = await api.get<ResumenItem[]>(url) // ApiResult<T>

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
      `${it.patente} ${it.movil_id ?? ''} ${it.ultima_fecha ?? ''}`.toLowerCase().includes(term),
    )
  }, [items, q])

  const exportarPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(`Historial por patente ${movilId ? `(Móvil #${movilId})` : ''}`, 14, 16)

    const body = filtrados.map((x) => [
      x.patente,
      x.movil_id ?? '',
      x.veces ?? 0,
      x.ultima_fecha || '-',
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
      {/* HEADER estilo HistorialDelDia */}
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

      {/* BODY */}
      {cargando ? (
        <div className="hp-card hp-muted">Cargando…</div>
      ) : filtrados.length === 0 ? (
        <div className="hp-card hp-muted">No hay resultados.</div>
      ) : (
        <div className="hp-grid">
          {filtrados.map((it) => (
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
                  <dd>{it.ultima_fecha || '-'}</dd>
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
