import React, { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'

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

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
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

function uniqByKey(items: AdicionalItem[]) {
  const keyOf = (x: AdicionalItem) =>
    [
      normalizeText(x.empresa),
      normalizeText(x.nroAfiliado),
      normalizeText(x.nombre),
      normalizeText(x.dni),
      normalizeText(x.adicional),
      x.fechaISO,
    ].join('|')

  const map = new Map<string, AdicionalItem>()
  items.forEach((it) => {
    const k = keyOf(it)
    if (!map.has(k)) map.set(k, it)
  })
  return Array.from(map.values())
}

function buildPdf(monthLabel: string, grouped: Array<{ empresa: string; rows: AdicionalItem[] }>) {
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

async function apiGet<T>(path: string, params?: Record<string, string | undefined>) {
const base = import.meta.env.VITE_API_BASE_URL

if (!base) {
  throw new Error('Falta VITE_API_BASE_URL en .env')
}

  const qs = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v)
    })
  }

  const url = `${base.replace(/\/$/, '')}${path}${qs.toString() ? `?${qs}` : ''}`

  const res = await fetch(url, {
    headers: {
      // ✅ temporal, hasta que conectemos JWT
      'x-user-id': 'dev-user',
    },
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return (await res.json()) as T
}

export default function AdicionalesScreen() {
  const [items, setItems] = useState<AdicionalItem[]>([])
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

  useEffect(() => {
    const { from, to } = monthRange(month)
    void (async () => {
      const data = await apiGet<{ items: AdicionalItem[] }>('/laboral/adicionales', {
        from,
        to,
        q: q.trim() || undefined,
      })
      setItems(uniqByKey(data.items || []))
    })()
  }, [month, q])

  const filtered = useMemo(() => {
    // ya viene filtrado por mes desde backend (from/to), pero igual dejamos esto por seguridad
    const inMonth = items.filter((x) => monthKeyFromISO(x.fechaISO) === month)
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
  }, [items, q, month])

  const grouped = useMemo(() => {
    const map = new Map<string, AdicionalItem[]>()
    filtered.forEach((x) => {
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
  }, [filtered])

  function downloadPdf() {
    const doc = buildPdf(monthLabel, grouped)
    doc.save(`Adicionales_${month}.pdf`)
  }

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
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.fechaISO}</td>
                          <td>{r.nombre}</td>
                          <td>{r.dni}</td>
                          <td>{r.nroAfiliado || '-'}</td>
                          <td>{r.adicional}</td>
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
