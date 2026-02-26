import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { api } from '@/lib/api'
import type { ApiResult } from '@/lib/types'
import { useMovilId } from '@/screens/useMovilId'

type HistRow = {
  id?: string | number
  movil_numero?: number | null

  hora_entrada?: string | null
  hora_salida?: string | null
  salida_indefinida?: boolean | number | null
  patente?: string | null
  motivo?: string | null
  prioridad?: 'baja' | 'alta' | 'urgente' | string | null
  anotaciones?: string | null
}

const todayISO = () => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function safeLower(x: unknown) {
  return String(x ?? '').toLowerCase()
}

function asPrioridad(x: unknown) {
  const v = String(x ?? 'baja').toLowerCase().trim()
  if (v === 'urgente' || v === 'alta' || v === 'baja') return v
  return 'baja'
}

export default function HistorialDelDiaScreen() {
  const nav = useNavigate()
  const movilId = useMovilId() // puede ser null en /historial-dia (global)

  const [fecha, setFecha] = useState<string>(todayISO())
  const [rows, setRows] = useState<HistRow[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const fechaSafe = fecha || todayISO()

      const j = await api.get<ApiResult<HistRow[]>>(
        '/historial-dia',
        movilId
          ? { fecha: fechaSafe, movilId: String(movilId), movil_id: String(movilId) } // compat
          : { fecha: fechaSafe }, // ✅ GLOBAL
      )

      const data =
        (j as any)?.ok === true
          ? ((j as any)?.data ?? [])
          : Array.isArray(j)
            ? j
            : (j as any)?.data ?? []

      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('GET /historial-dia', e)
      alert('No se pudo cargar el historial del día.')
    } finally {
      setLoading(false)
    }
  }, [fecha, movilId])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const filtered = useMemo(() => {
    const s = safeLower(q)
    if (!s) return rows
    return rows.filter((r) => {
      return (
        safeLower(r.movil_numero).includes(s) ||
        safeLower(r.patente).includes(s) ||
        safeLower(r.prioridad).includes(s) ||
        safeLower(r.anotaciones).includes(s) ||
        safeLower(r.motivo).includes(s)
      )
    })
  }, [rows, q])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      // si es global, ordenamos por movil primero y luego hora
      const am = String(a.movil_numero ?? '')
      const bm = String(b.movil_numero ?? '')
      if (!movilId && am !== bm) return am.localeCompare(bm)
      return String(a.hora_entrada || '').localeCompare(String(b.hora_entrada || ''))
    })
    return copy
  }, [filtered, movilId])

  const prioridadPill = (p: HistRow['prioridad']) => {
    const v = asPrioridad(p)
    return <span className={`hd-pill hd-pill--${v}`}>{v}</span>
  }

  const title = movilId ? `Historial del día — Móvil ${movilId}` : 'Historial del día — Todos los móviles'

  const toPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt' })
    doc.setFontSize(14)
    doc.text(`${title} — ${fecha || todayISO()}`, 40, 36)

    const head = movilId
      ? [['Hora entrada', 'Hora salida', 'Patente', 'Motivo', 'Prioridad', 'Observaciones']]
      : [['Móvil', 'Hora entrada', 'Hora salida', 'Patente', 'Motivo', 'Prioridad', 'Observaciones']]

    const body = sorted.map((r) => {
      const base = [
        r.hora_entrada || '-',
        r.salida_indefinida ? 'Indefinido' : r.hora_salida || '-',
        r.patente || '-',
        r.motivo || '',
        asPrioridad(r.prioridad).toUpperCase(),
        r.anotaciones || '',
      ]
      return movilId ? base : [String(r.movil_numero ?? '-'), ...base]
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
    doc.save(`historial-dia_${suf}_${fecha || todayISO()}.pdf`)
  }

  const toExcel = async () => {
    try {
      const mod: any = await import('xlsx')
      const XLSX = mod?.default ?? mod

      const data = sorted.map((r) => ({
        Fecha: fecha || todayISO(),
        Movil: String(r.movil_numero ?? movilId ?? ''),
        'Hora entrada': r.hora_entrada || '',
        'Hora salida': r.salida_indefinida ? 'Indefinido' : r.hora_salida || '',
        Patente: r.patente || '',
        Motivo: r.motivo || '',
        Prioridad: asPrioridad(r.prioridad).toUpperCase(),
        Observaciones: r.anotaciones || '',
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(data)
      XLSX.utils.book_append_sheet(wb, ws, 'Historial')

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      const a = document.createElement('a')
      const href = URL.createObjectURL(blob)
      a.href = href

      const suf = movilId ? `movil-${movilId}` : 'global'
      a.download = `historial-dia_${suf}_${fecha || todayISO()}.xlsx`

      a.click()
      setTimeout(() => URL.revokeObjectURL(href), 1500)
    } catch (e) {
      console.error('xlsx export', e)
      alert('Para exportar a Excel instalá: npm i xlsx')
    }
  }

  return (
    <div className="historial-dia">
      <header className="hd-header">
        <div className="hd-left">
          <button className="btn btn--outline" onClick={() => nav(movilId ? `/movil/${movilId}` : `/`)} type="button">
            Volver
          </button>
          <div className="hd-titlewrap">
            <h1 className="hd-title">Historial del día</h1>
            <div className="hd-subtitle">{movilId ? `Móvil ${movilId}` : 'Todos los móviles'}</div>
          </div>
        </div>

        <div className="hd-right">
          <label className="hd-field">
            <span>Fecha</span>
            <input
              className="input hd-date"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.currentTarget.value)}
            />
          </label>

          <input
            className="input hd-search"
            placeholder={movilId ? 'Buscar (patente, motivo, prioridad, observaciones)' : 'Buscar (móvil, patente, motivo, prioridad, observaciones)'}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />

          <div className="hd-actions">
            <button className="btn btn--primary" onClick={fetchRows} disabled={loading} type="button">
              ↻ Actualizar
            </button>
            <button className="btn btn--primary" onClick={toPDF} type="button">
              ⬇️ PDF
            </button>
            <button className="btn btn--primary" onClick={toExcel} type="button">
              ⬇️ Excel
            </button>
          </div>
        </div>
      </header>

      <div className="hd-tablewrap">
        <table className="hd-table">
          <thead>
            <tr>
              {!movilId && <th>Móvil</th>}
              <th>Hora entrada</th>
              <th>Hora salida</th>
              <th>Patente</th>
              <th>Motivo</th>
              <th>Prioridad</th>
              <th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={movilId ? 6 : 7} className="hd-muted">
                  Cargando...
                </td>
              </tr>
            )}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={movilId ? 6 : 7} className="hd-muted">
                  Sin registros para esta fecha.
                </td>
              </tr>
            )}

            {!loading &&
              sorted.map((r, idx) => (
                <tr key={String(r.id ?? `${r.hora_entrada ?? 'row'}-${idx}`)}>
                  {!movilId && <td className="hd-mono">{r.movil_numero ?? '-'}</td>}
                  <td className="hd-mono">{r.hora_entrada || '-'}</td>
                  <td className="hd-mono">{r.salida_indefinida ? 'Indefinido' : r.hora_salida || '-'}</td>
                  <td className="hd-strong">{r.patente || '-'}</td>
                  <td>{r.motivo || ''}</td>
                  <td>{prioridadPill(r.prioridad)}</td>
                  <td className="hd-anot">{r.anotaciones || ''}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
