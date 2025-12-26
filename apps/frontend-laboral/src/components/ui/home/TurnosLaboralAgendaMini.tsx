import React, { useCallback, useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'
import { laboralTurnosList, type LaborTurno } from '@/api/laboralTurnosApi'

function isoDay(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function dayPart(iso: string) {
  return (iso || '').slice(0, 10)
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(base: Date, delta: number) {
  const d = new Date(base)
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  return d
}

function monthLabelES(d: Date) {
  const meses = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ]
  return `${meses[d.getMonth()]} de ${d.getFullYear()}`
}

function buildMonthMatrix(anchor: Date) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()

  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  // lunes=0 ... domingo=6
  const firstDow = (first.getDay() + 6) % 7
  const daysInMonth = last.getDate()

  const cells: Array<{ day: number; iso: string; inMonth: boolean }> = []
  for (let i = 0; i < firstDow; i++) cells.push({ day: 0, iso: '', inMonth: false })

  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(year, month, day)
    cells.push({ day, iso: isoDay(dt), inMonth: true })
  }

  while (cells.length % 7 !== 0) cells.push({ day: 0, iso: '', inMonth: false })

  const weeks: typeof cells[] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  return weeks
}

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function getTurnoHora(t: LaborTurno): string {
  const anyT = t as unknown as { horaTurno?: unknown; hora?: unknown; fechaTurnoISO?: unknown }
  const h1 = typeof anyT.horaTurno === 'string' ? anyT.horaTurno : ''
  if (h1 && /^\d{2}:\d{2}$/.test(h1)) return h1

  const h2 = typeof anyT.hora === 'string' ? anyT.hora : ''
  if (h2 && /^\d{2}:\d{2}$/.test(h2)) return h2

  const f = typeof anyT.fechaTurnoISO === 'string' ? anyT.fechaTurnoISO : ''
  if (f.includes('T')) {
    const hhmm = f.split('T')[1]?.slice(0, 5) || ''
    if (/^\d{2}:\d{2}$/.test(hhmm)) return hhmm
  }
  return ''
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function buildTimeSlots(fromHH = 8, toHH = 18, stepMin = 30) {
  const out: string[] = []
  const start = fromHH * 60
  const end = toHH * 60
  for (let m = start; m <= end; m += stepMin) {
    const hh = Math.floor(m / 60)
    const mm = m % 60
    out.push(`${pad2(hh)}:${pad2(mm)}`)
  }
  return out
}

function escapeHtml(s: string) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function buildPdfTurnosMes(turnos: LaborTurno[], monthTitle: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const groups = new Map<string, LaborTurno[]>()
  for (const t of turnos) {
    const key = (t.empresa || 'Sin empresa').trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  const empresas = Array.from(groups.keys()).sort((a, b) =>
    normalizeText(a).localeCompare(normalizeText(b)),
  )

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Medic Laboral - Turnos laborales del mes', margin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(monthTitle, margin, 22)
  doc.text(new Date().toLocaleDateString(), pageW - margin, 16, { align: 'right' })

  let y = 30

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageH - margin) return
    doc.addPage()
    y = margin
  }

  for (const emp of empresas) {
    const list = (groups.get(emp) || []).slice().sort((a, b) => {
      const by = dayPart(a.fechaTurnoISO || '').localeCompare(dayPart(b.fechaTurnoISO || ''))
      if (by !== 0) return by
      const ha = getTurnoHora(a)
      const hb = getTurnoHora(b)
      if (ha !== hb) return ha.localeCompare(hb)
      return (a.createdAt || '').localeCompare(b.createdAt || '')
    })

    ensureSpace(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(`${emp} (${list.length})`, margin, y)
    y += 6

    ensureSpace(8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text('Fecha', margin, y)
    doc.text('Hora', margin + 22, y)
    doc.text('DNI', margin + 38, y)
    doc.text('Nombre', margin + 62, y)
    doc.text('Puesto', margin + 118, y)
    doc.text('Examen', margin + 154, y)
    y += 4
    doc.setDrawColor(210)
    doc.line(margin, y, pageW - margin, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.2)

    for (const t of list) {
      ensureSpace(7)

      const fecha = dayPart(t.fechaTurnoISO || '-') || '-'
      const hora = getTurnoHora(t) || '-'
      const dni = (t.dni || '-').slice(0, 14)
      const nombre = (t.nombre || '-').slice(0, 28)
      const puesto = (t.puesto || '-').slice(0, 18)
      const examen = (t.tipoExamen || '-').slice(0, 20)

      doc.text(fecha, margin, y)
      doc.text(hora, margin + 22, y)
      doc.text(dni, margin + 38, y)
      doc.text(nombre, margin + 62, y)
      doc.text(puesto, margin + 118, y)
      doc.text(examen, margin + 154, y)
      y += 6
    }

    y += 4
  }

  return doc
}

export function TurnosLaboralAgendaMini() {
  const [turnos, setTurnos] = useState<LaborTurno[]>([])
  const [anchor, setAnchor] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const [selectedISO, setSelectedISO] = useState<string>(() => isoDay(new Date()))

  const loadMonth = useCallback(async () => {
    const mk = monthKey(anchor)
    try {
      const list = await laboralTurnosList({ month: mk })
      setTurnos(list)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudieron cargar los turnos del mes'
      console.error(e)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: msg,
      })
    }
  }, [anchor])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadMonth()
    }, 0)

    return () => window.clearTimeout(t)
  }, [loadMonth])

  const countByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of turnos) {
      const d = dayPart(t.fechaTurnoISO || '')
      if (!d) continue
      m.set(d, (m.get(d) || 0) + 1)
    }
    return m
  }, [turnos])

  const weeks = useMemo(() => buildMonthMatrix(anchor), [anchor])
  const monthTitle = useMemo(() => monthLabelES(anchor), [anchor])

  function goToday() {
    const d = new Date()
    const a = new Date(d.getFullYear(), d.getMonth(), 1)
    setAnchor(a)
    setSelectedISO(isoDay(d))
  }

  function downloadPdfMes() {
    if (!turnos.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sin turnos',
        text: 'Este mes no tiene turnos laborales cargados.',
        timer: 1800,
        showConfirmButton: false,
      })
      return
    }
    const doc = buildPdfTurnosMes(turnos, monthTitle)
    doc.save(`TurnosLaborales_${monthKey(anchor)}.pdf`)
  }

  function openDaySchedule(dayISO: string) {
    const dayTurns = turnos
      .filter((t) => dayPart(t.fechaTurnoISO || '') === dayISO)
      .slice()
      .sort((a, b) => {
        const ha = getTurnoHora(a)
        const hb = getTurnoHora(b)
        if (ha !== hb) return ha.localeCompare(hb)
        return normalizeText(a.empresa || '').localeCompare(normalizeText(b.empresa || ''))
      })

    const byHour = new Map<string, LaborTurno[]>()
    for (const t of dayTurns) {
      const h = getTurnoHora(t) || ''
      if (!h) continue
      if (!byHour.has(h)) byHour.set(h, [])
      byHour.get(h)!.push(t)
    }

    const slots = buildTimeSlots(8, 18, 30)
    const ocupados = slots.filter((h) => (byHour.get(h) || []).length > 0).length
    const libres = slots.length - ocupados

    const rowsHtml = slots
      .map((h) => {
        const list = byHour.get(h) || []
        const ocupado = list.length > 0
        const head = ocupado ? list[0] : null

        const extra =
          ocupado && head
            ? `<div class="slot__detail">
                 <div><b>${escapeHtml(head.empresa || 'Sin empresa')}</b></div>
                 <div class="slot__muted">${escapeHtml(head.nombre || '-')} · DNI ${escapeHtml(head.dni || '-')}</div>
                 <div class="slot__muted">${escapeHtml(head.tipoExamen || '-')} · ${escapeHtml(head.sede === 'caba' ? 'CABA' : 'San Justo')}</div>
                 ${list.length > 1 ? `<div class="slot__muted">+${list.length - 1} más</div>` : ''}
               </div>`
            : `<div class="slot__detail slot__muted">Disponible</div>`

        return `
          <div class="slot ${ocupado ? 'slot--busy' : 'slot--free'}">
            <div class="slot__time">${escapeHtml(h)}</div>
            <div class="slot__status">
              <span class="badge ${ocupado ? 'badge--busy' : 'badge--free'}">${ocupado ? 'Ocupado' : 'Libre'}</span>
            </div>
            <div class="slot__info">${extra}</div>
          </div>
        `
      })
      .join('')

    const html = `
      <style>
        .slots { display:flex; flex-direction:column; gap:10px; }
        .slots__meta { display:flex; gap:10px; flex-wrap:wrap; margin:6px 0 12px; color:#64748b; font-size:.92rem; }
        .slots__meta b { color:#0f172a; }
        .slot { border:1px solid rgba(148,163,184,.35); border-radius:14px; background:rgba(255,255,255,.92); padding:10px 12px; display:grid; grid-template-columns:78px 92px 1fr; gap:10px; align-items:start; }
        .slot--busy { border-color: rgba(244,63,94,.28); }
        .slot--free { border-color: rgba(0,143,107,.22); }
        .slot__time { font-weight:800; color:#0f172a; }
        .badge { display:inline-flex; align-items:center; justify-content:center; padding:4px 10px; border-radius:999px; font-weight:800; font-size:.78rem; border:1px solid transparent; }
        .badge--busy { background:#fee2e2; color:#991b1b; border-color:#fecaca; }
        .badge--free { background:rgba(0,143,107,.10); color:rgba(0,143,107,.95); border-color:rgba(0,143,107,.20); }
        .slot__detail { line-height:1.2; }
        .slot__muted { color:#64748b; font-size:.88rem; margin-top:2px; }
        .slots__wrap { max-height: 60vh; overflow:auto; padding-right:6px; }
        .slots__wrap::-webkit-scrollbar { width: 10px; }
        .slots__wrap::-webkit-scrollbar-thumb { background: rgba(148,163,184,.35); border-radius: 999px; border: 2px solid rgba(255,255,255,.6); }
      </style>

      <div class="slots">
        <div class="slots__meta">
          <div><b>${escapeHtml(dayISO)}</b></div>
          <div>· Ocupados: <b>${ocupados}</b></div>
          <div>· Libres: <b>${libres}</b></div>
        </div>

        <div class="slots__wrap">
          ${rowsHtml || '<div style="color:#64748b">Sin horarios.</div>'}
        </div>
      </div>
    `

    void Swal.fire({
      title: 'Horarios del día',
      html,
      width: 920,
      showConfirmButton: false,
      showCloseButton: true,
      focusConfirm: false,
      customClass: { popup: 'swal-popup', title: 'swal-title', htmlContainer: 'swal-text' },
    })
  }

  return (
    <section className="lab-agenda">
      <header className="lab-agenda__head">
        <div>
          <h3 className="lab-agenda__title">Turnos laborales del mes</h3>
          <div className="lab-agenda__sub">{monthTitle}</div>
        </div>

        <div className="lab-agenda__actions">
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => setAnchor(addMonths(anchor, -1))}
          >
            ‹
          </button>
          <button type="button" className="btn btn--outline btn--sm" onClick={goToday}>
            Hoy
          </button>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => setAnchor(addMonths(anchor, +1))}
          >
            ›
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={downloadPdfMes}>
            Descargar PDF
          </button>
        </div>
      </header>

      <div className="lab-agenda__cal">
        <div className="lab-agenda__dow">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => (
            <div key={i} className="lab-agenda__dowCell">
              {x}
            </div>
          ))}
        </div>

        <div className="lab-agenda__grid">
          {weeks.flat().map((cell, idx) => {
            const iso = cell.inMonth ? cell.iso : ''
            const cnt = iso ? countByDay.get(iso) || 0 : 0
            const selected = cell.inMonth && iso === selectedISO

            return (
              <button
                key={idx}
                type="button"
                className={
                  'lab-agenda__day' +
                  (cell.inMonth ? '' : ' lab-agenda__day--off') +
                  (selected ? ' lab-agenda__day--sel' : '')
                }
                onClick={() => {
                  if (!cell.inMonth) return
                  setSelectedISO(cell.iso)
                  openDaySchedule(cell.iso)
                }}
                disabled={!cell.inMonth}
              >
                <div className="lab-agenda__num">{cell.inMonth ? cell.day : ''}</div>
                {cnt > 0 && <div className="lab-agenda__badge">{cnt}</div>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="lab-agenda__hint" style={{ marginTop: 10, color: 'var(--color-ink-soft)', fontSize: '.9rem' }}>
        Tip: hacé click en un día para ver el detalle de horarios (libres/ocupados).
      </div>
    </section>
  )
}

export default TurnosLaboralAgendaMini
