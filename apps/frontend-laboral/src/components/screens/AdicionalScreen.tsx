import React, { useEffect, useMemo, useState, useCallback } from 'react'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'

import trashGradient from '@/assets/icons/trash-gradient.png'

type AdicionalItem = {
  id: string
  empresa: string
  nroAfiliado: string
  nombre: string
  dni: string
  adicional: string
  fechaISO: string // YYYY-MM-DD
  createdAt: string
}

type AdicionalDisplayRow = {
  ids: string[] // ✅ todas las filas originales que forman este "A + B + C"
  empresa: string
  nroAfiliado: string
  nombre: string
  dni: string
  fechaISO: string
  adicional: string // ✅ ya concatenado "A + B + C"
  createdAtMin: string
}

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function normalizeKey(s: string) {
  return normalizeText(s).replace(/[^a-z0-9]+/g, ' ').trim()
}

function monthKeyFromISO(iso: string) {
  return (iso || '').slice(0, 7)
}

function alpha(a: string, b: string) {
  const aa = normalizeText(a)
  const bb = normalizeText(b)
  if (aa < bb) return -1
  if (aa > bb) return 1
  return 0
}

function uniqStringsByNorm(items: string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const it of items) {
    const k = normalizeKey(it)
    if (!k) continue
    if (seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}

/**
 * ✅ MERGE:
 * Agrupa filas que pertenecen al MISMO paciente/fecha/empresa y une "adicional" como "A + B + C".
 */
function mergeAdicionales(items: AdicionalItem[]): AdicionalDisplayRow[] {
  const keyOf = (x: AdicionalItem) =>
    [
      normalizeText(x.empresa),
      normalizeText(x.fechaISO),
      normalizeText(x.dni),
      normalizeText(x.nombre),
      normalizeText(x.nroAfiliado || ''),
    ].join('|')

  const map = new Map<string, AdicionalItem[]>()

  for (const it of items) {
    const k = keyOf(it)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(it)
  }

  const merged: AdicionalDisplayRow[] = []

  for (const group of map.values()) {
    // orden estable dentro del grupo
    group.sort((a, b) => {
      const byCreated = (a.createdAt || '').localeCompare(b.createdAt || '')
      if (byCreated !== 0) return byCreated
      return alpha(a.adicional, b.adicional)
    })

    const first = group[0]
    const adicionales = uniqStringsByNorm(group.map((x) => x.adicional || '').filter(Boolean))
      .slice()
      .sort(alpha)

    merged.push({
      ids: group.map((x) => x.id),
      empresa: first.empresa || '—',
      nroAfiliado: first.nroAfiliado || '',
      nombre: first.nombre || '—',
      dni: first.dni || '—',
      fechaISO: first.fechaISO || '—',
      adicional: adicionales.length ? adicionales.join(' + ') : '—',
      createdAtMin: first.createdAt || '',
    })
  }

  return merged
}

function buildPdf(monthLabel: string, grouped: Array<{ empresa: string; rows: AdicionalDisplayRow[] }>) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Adicionales - Rendición mensual', margin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(monthLabel, pageW - margin, 16, { align: 'right' })

  let y = 26

  grouped.forEach((g) => {
    if (y > 270) {
      doc.addPage()
      y = 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(g.empresa || '—', margin, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text('Fecha', margin, y)
    doc.text('Nombre y Apellido', margin + 28, y)
    doc.text('DNI', margin + 112, y)
    doc.text('N° afiliado', margin + 140, y)
    doc.text('Adicional', margin + 170, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.2)

    g.rows.forEach((r) => {
      if (y > 280) {
        doc.addPage()
        y = 16
      }
      doc.text(r.fechaISO || '—', margin, y)
      doc.text((r.nombre || '—').slice(0, 36), margin + 28, y)
      doc.text((r.dni || '—').slice(0, 12), margin + 112, y)
      doc.text((r.nroAfiliado || '—').slice(0, 14), margin + 140, y)

      const ad = r.adicional || '—'
      const adLines = doc.splitTextToSize(ad, pageW - (margin + 170) - margin)
      doc.text(adLines, margin + 170, y)
      y += Math.max(5, adLines.length * 4.6)
    })

    y += 6
  })

  return doc
}

function monthRange(month: string) {
  // month: YYYY-MM
  const [yStr, mStr] = month.split('-')
  const y = Number(yStr)
  const m = Number(mStr) // 1..12
  const from = `${yStr}-${mStr}-01`
  const lastDay = new Date(y, m, 0).getDate()
  const to = `${yStr}-${mStr}-${String(lastDay).padStart(2, '0')}`
  return { from, to }
}

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  params?: Record<string, string | undefined>,
) {
  const base = import.meta.env.VITE_API_BASE_URL
  if (!base) throw new Error('Falta VITE_API_BASE_URL en .env')

  const qs = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v)
    })
  }

  const url = `${base.replace(/\/$/, '')}${path}${qs.toString() ? `?${qs}` : ''}`

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      // ✅ temporal, hasta que conectemos JWT
      'x-user-id': 'dev-user',
    },
  })

  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as T
}

export default function AdicionalesScreen() {
  const [rawItems, setRawItems] = useState<AdicionalItem[]>([])
  const [q, setQ] = useState('')

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)

  const monthLabel = useMemo(() => {
    const [y, m] = month.split('-')
    const mm = Number(m || '1')
    const names = [
      'enero','febrero','marzo','abril','mayo','junio',
      'julio','agosto','septiembre','octubre','noviembre','diciembre',
    ]
    return `${names[Math.max(0, Math.min(11, mm - 1))]} de ${y}`
  }, [month])

  const load = useCallback(async () => {
    const { from, to } = monthRange(month)
    const data = await apiRequest<{ items: AdicionalItem[] }>(
      '/laboral/adicionales',
      undefined,
      { from, to, q: q.trim() || undefined },
    )
    setRawItems(Array.isArray(data.items) ? data.items : [])
  }, [month, q])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(t)
  }, [load])

  // ✅ 1) Filtra por mes y búsqueda (sobre raw)
  const filteredRaw = useMemo(() => {
    const inMonth = rawItems.filter((x) => monthKeyFromISO(x.fechaISO) === month)
    const qq = normalizeText(q)
    if (!qq) return inMonth
    return inMonth.filter((x) => {
      const hay =
        normalizeText(x.empresa) +
        ' ' +
        normalizeText(x.nroAfiliado) +
        ' ' +
        normalizeText(x.nombre) +
        ' ' +
        normalizeText(x.dni) +
        ' ' +
        normalizeText(x.adicional)
      return hay.includes(qq)
    })
  }, [rawItems, q, month])

  // ✅ 2) Mergea a displayRows: "A + B + C"
  const displayRows = useMemo(() => mergeAdicionales(filteredRaw), [filteredRaw])

  // ✅ 3) Agrupa por empresa para mostrar tablas
  const grouped = useMemo(() => {
    const map = new Map<string, AdicionalDisplayRow[]>()
    displayRows.forEach((x) => {
      const key = x.empresa || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(x)
    })

    const empresas = Array.from(map.keys()).sort(alpha)
    return empresas.map((empresa) => {
      const rows = (map.get(empresa) || []).slice().sort((a, b) => {
        const byName = alpha(a.nombre, b.nombre)
        if (byName !== 0) return byName
        const byDate = (a.fechaISO || '').localeCompare(b.fechaISO || '')
        if (byDate !== 0) return byDate
        return alpha(a.adicional, b.adicional)
      })
      return { empresa, rows }
    })
  }, [displayRows])

  const downloadPdf = useCallback(() => {
    const doc = buildPdf(monthLabel, grouped)
    doc.save(`Adicionales_${month}.pdf`)
  }, [month, monthLabel, grouped])

  // ✅ elimina todas las filas que componen el "A + B + C"
  const removeDisplayRow = useCallback(async (row: AdicionalDisplayRow) => {
    const res = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar adicional(es)',
      html: `¿Seguro que querés eliminar estos adicional(es) de <b>${row.nombre}</b>?<br/><br/>
             <span style="color:#64748b">${row.adicional}</span>`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
    })

    if (!res.isConfirmed) return

    try {
      // borramos todas las IDs
      await Promise.all(
        row.ids.map((id) =>
          apiRequest<{ ok: true }>(`/laboral/adicionales/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          }),
        ),
      )

      // actualizamos rawItems removiendo todas las ids
      const idsSet = new Set(row.ids)
      setRawItems((prev) => prev.filter((x) => !idsSet.has(x.id)))

      Swal.fire({
        icon: 'success',
        title: 'Eliminado',
        text: 'El/los adicional(es) fueron eliminados.',
        timer: 1300,
        showConfirmButton: false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: msg })
    }
  }, [])

  return (
    <div className="adicionales">
      <div className="card adicionales__card">
        <div className="adicionales__head">
          <div>
            <h2 className="adicionales__title">Adicionales</h2>
            <p className="adicionales__subtitle">Rendición mensual. Ordenado por empresa y alfabético.</p>
          </div>

          <div className="adicionales__right">
            <label className="adicionales__month">
              <span>Mes</span>
              <input
                type="month"
                className="input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>

            <button className="btn btn--primary" type="button" onClick={downloadPdf}>
              Descargar PDF
            </button>
          </div>
        </div>

        <div className="adicionales__search">
          <input
            className="input"
            placeholder="Buscar por empresa, afiliado, nombre, DNI o adicional…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="adicionales__groups">
          {grouped.length === 0 ? (
            <div className="adicionales__empty">No hay adicionales guardados para este mes.</div>
          ) : (
            grouped.map((g) => (
              <div key={g.empresa} className="adicionales__group">
                <div className="adicionales__groupHead">
                  <h3>{g.empresa}</h3>
                  <span className="muted">{g.rows.length} items</span>
                </div>

                <div className="adicionales__tableWrap">
                  <table className="adicionales__table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Nombre y Apellido</th>
                        <th>DNI</th>
                        <th>N° afiliado</th>
                        <th>Adicional</th>
                        <th style={{ width: 44 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.ids.join('|')}>
                          <td>{r.fechaISO}</td>
                          <td>{r.nombre}</td>
                          <td>{r.dni}</td>
                          <td>{r.nroAfiliado || '-'}</td>

                          {/* ✅ ahora siempre aparece "A + B + C" */}
                          <td>{r.adicional}</td>

                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => void removeDisplayRow(r)}
                              title="Eliminar"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 12,
                                border: '1px solid rgba(148,163,184,.35)',
                                background: 'rgba(255,255,255,.9)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <img
                                src={trashGradient}
                                alt="Eliminar"
                                style={{ width: 18, height: 18, display: 'block' }}
                              />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
