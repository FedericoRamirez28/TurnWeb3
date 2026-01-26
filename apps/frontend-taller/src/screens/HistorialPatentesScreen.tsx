import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { ApiResult } from '@/lib/types'

type Params = { movilId?: string }

type HistorialItem = {
  id: string
  movilId: number
  patente: string
  fecha: string
  anotaciones?: string | null
  tareas?: { id: string; text: string; done: boolean }[] | null
  prioridad?: 'baja' | 'alta' | 'urgente' | null
}

type HistorialResponse = ApiResult<HistorialItem[]>

export default function HistorialPatentesScreen() {
  const nav = useNavigate()
  const { movilId: movilIdParam } = useParams<Params>()
  const [params] = useSearchParams()

  // ✅ soporta: /historial (global) | /movil/:movilId/historial | /historial?movilId=10
  const movilId =
    (movilIdParam?.trim() || params.get('movilId')?.trim() || '') || ''
  const movilIdNum = movilId ? Number(movilId) : null

  const [items, setItems] = useState<HistorialItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    let abort = false
    setCargando(true)

    ;(async () => {
      try {
        const url = movilId
          ? `/historial?movilId=${encodeURIComponent(movilId)}`
          : `/historial`

        const j = await api.get<HistorialResponse>(url)

        if (abort) return

        if (j.ok) setItems(j.data || [])
        else {
          console.error('Error cargando historial:', j.error)
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

    return items.filter((it) => {
      const p = String(it.patente || '').toLowerCase()
      const m = String(it.movilId)
      const a = String(it.anotaciones || '').toLowerCase()
      return p.includes(term) || m.includes(term) || a.includes(term)
    })
  }, [items, q])

  return (
    <div className="hp-screen">
      <div className="hp-top card">
        <div className="hp-top__left">
          <h2 className="hp-title">
            Historial por patente{movilIdNum ? ` — móvil ${movilIdNum}` : ''}
          </h2>
          <p className="hp-subtitle">Buscá por patente, móvil o anotaciones.</p>
        </div>

        <div className="hp-top__right">
          <button type="button" className="btn btn--outline" onClick={() => nav('/')}>
            Volver
          </button>
        </div>

        <div className="hp-search">
          <input
            className="input"
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
        </div>
      </div>

      <div className="hp-body card">
        {cargando ? (
          <div className="hp-loading">Cargando…</div>
        ) : filtrados.length === 0 ? (
          <div className="hp-empty">No hay registros.</div>
        ) : (
          <div className="hp-list">
            {filtrados.map((it) => (
              <button
                key={it.id}
                type="button"
                className="hp-row"
                // ✅ tu router es /movil/:movilId
                onClick={() => nav(`/movil/${encodeURIComponent(String(it.movilId))}`)}
              >
                <div className="hp-row__main">
                  <div className="hp-row__title">
                    <span className="hp-chip">{it.movilId}</span>
                    <span className="hp-pat">{it.patente}</span>
                  </div>

                  <div className="hp-row__meta">
                    <span className="hp-date">{it.fecha}</span>
                    {it.prioridad && (
                      <span className={`hp-prio hp-prio--${it.prioridad}`}>
                        {it.prioridad}
                      </span>
                    )}
                  </div>

                  {it.anotaciones && <div className="hp-note">{it.anotaciones}</div>}
                </div>

                <div className="hp-row__cta">Abrir</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
