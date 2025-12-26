import React, { useMemo, useState, useCallback, useEffect } from 'react'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'

import { createConsultorioTurno, listConsultorios } from '@/api/consultoriosApi'
import { listCompanies, type Company as ApiCompany } from '@/api/companiesApi'

type Company = ApiCompany

type ConsultorioTurno = {
  id: string
  empresaId: string
  empresaNombre: string

  dni: string
  nombre: string
  nacimientoISO: string
  motivo: string
  diagnostico: string

  fechaTurnoISO: string
  createdAt: string
}

type Draft = {
  empresaId: string
  dni: string
  nombre: string
  nacimientoISO: string
  motivo: string
  diagnostico: string
  fechaTurnoISO: string
}

const STORAGE_KEY_CONSULTORIOS_DRAFT = 'medic_laboral_consultorios_draft_v1'

function isoDay(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function safeLoadDraft(): Draft {
  const fallback: Draft = {
    empresaId: '',
    dni: '',
    nombre: '',
    nacimientoISO: '',
    motivo: '',
    diagnostico: '',
    fechaTurnoISO: isoDay(new Date()),
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONSULTORIOS_DRAFT)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Draft>
    return {
      ...fallback,
      ...parsed,
      fechaTurnoISO: parsed.fechaTurnoISO || fallback.fechaTurnoISO,
    }
  } catch {
    return fallback
  }
}

function safeSaveDraft(d: Draft) {
  try {
    localStorage.setItem(STORAGE_KEY_CONSULTORIOS_DRAFT, JSON.stringify(d))
  } catch {
    // no-op
  }
}

function fmtMonthTitle(year: number, monthIndex0: number) {
  const d = new Date(year, monthIndex0, 1)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

function ymd(year: number, monthIndex0: number, day: number) {
  const mm = String(monthIndex0 + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

function buildPdfConsultorios(turnosList: ConsultorioTurno[], title: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 14

  const byEmpresa = new Map<string, ConsultorioTurno[]>()
  turnosList.forEach((t) => {
    const k = (t.empresaNombre || '').trim()
    const arr = byEmpresa.get(k) || []
    arr.push(t)
    byEmpresa.set(k, arr)
  })

  const empresas = Array.from(byEmpresa.keys()).sort((a, b) => normalizeText(a).localeCompare(normalizeText(b)))

  let y = margin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('TURNOS CONSULTORIO', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(title, pageW - margin, y, { align: 'right' })

  y += 10
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.line(margin, y, pageW - margin, y)
  y += 6

  if (!empresas.length) {
    doc.setFontSize(10)
    doc.text('No hay turnos para mostrar.', margin, y)
    return doc
  }

  const ensureSpace = (need: number) => {
    if (y + need <= pageH - margin) return
    doc.addPage()
    y = margin
  }

  empresas.forEach((empresa) => {
    const list = (byEmpresa.get(empresa) || []).slice()
    list.sort((a, b) => {
      const byDate = (a.fechaTurnoISO || '').localeCompare(b.fechaTurnoISO || '')
      if (byDate !== 0) return byDate
      return (a.createdAt || '').localeCompare(b.createdAt || '')
    })

    ensureSpace(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(empresa || '(Sin empresa)', margin, y)
    y += 6

    ensureSpace(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.2)

    const cols = [
      { x: margin, w: 20, label: 'Fecha' },
      { x: margin + 22, w: 22, label: 'DNI' },
      { x: margin + 46, w: 50, label: 'Nombre' },
      { x: margin + 98, w: 24, label: 'Nac.' },
      { x: margin + 124, w: 36, label: 'Motivo' },
      { x: margin + 162, w: pageW - margin - (margin + 162), label: 'Diagnóstico' },
    ]
    cols.forEach((c) => doc.text(c.label, c.x, y))

    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.2)
    doc.line(margin, y, pageW - margin, y)
    y += 5

    list.forEach((t) => {
      const linesMotivo = doc.splitTextToSize(t.motivo || '-', cols[4].w)
      const linesDiag = doc.splitTextToSize(t.diagnostico || '-', cols[5].w)
      const linesNombre = doc.splitTextToSize(t.nombre || '-', cols[2].w)

      const rowH = Math.max(linesMotivo.length, linesDiag.length, linesNombre.length, 1) * 4.2
      ensureSpace(rowH + 6)

      doc.text(t.fechaTurnoISO || '-', cols[0].x, y)
      doc.text(t.dni || '-', cols[1].x, y)
      doc.text(linesNombre, cols[2].x, y)
      doc.text(t.nacimientoISO || '-', cols[3].x, y)
      doc.text(linesMotivo, cols[4].x, y)
      doc.text(linesDiag, cols[5].x, y)

      y += rowH
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.1)
      doc.line(margin, y + 1.5, pageW - margin, y + 1.5)
      y += 5
    })

    y += 3
  })

  return doc
}

export default function ConsultoriosScreen() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)

  const [turnos, setTurnos] = useState<ConsultorioTurno[]>([])
  const [draft, setDraft] = useState<Draft>(() => safeLoadDraft())

  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [monthIndex0, setMonthIndex0] = useState(now.getMonth())

  const monthTitle = useMemo(() => fmtMonthTitle(year, monthIndex0), [year, monthIndex0])

  useEffect(() => {
    safeSaveDraft(draft)
  }, [draft])

  const activeCompanies = useMemo(() => {
    const list = companies.slice()
    list.sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)))
    // en tu API Company esActive
    return list.filter((c) => c.isActive)
  }, [companies])

  const selectedCompany = useMemo(() => {
    return activeCompanies.find((c) => c.id === draft.empresaId) || null
  }, [activeCompanies, draft.empresaId])

  const monthResetKey = useMemo(() => `${year}-${monthIndex0}`, [year, monthIndex0])
  const [selectedDayISO, setSelectedDayISO] = useState<string>('')

  const monthStart = useMemo(() => ymd(year, monthIndex0, 1), [year, monthIndex0])
  const monthEnd = useMemo(() => ymd(year, monthIndex0, daysInMonth(year, monthIndex0)), [year, monthIndex0])

  // Cargar empresas
  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true)
    try {
      const r = await listCompanies({ q: '' })
      setCompanies((r.items || []).filter((c) => c.isActive))

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'Error al cargar empresas', text: msg })
    } finally {
      setCompaniesLoading(false)
    }
  }, [])

  // Cargar turnos del mes
  const loadMonth = useCallback(async () => {
    try {
      const res = await listConsultorios({ from: monthStart, to: monthEnd, take: 500 })
      setTurnos(
        res.map((x) => ({
          id: x.id,
          empresaId: x.empresaId,
          empresaNombre: x.empresaNombre,
          dni: x.dni,
          nombre: x.nombre,
          nacimientoISO: x.nacimientoISO || '',
          motivo: x.motivo,
          diagnostico: x.diagnostico,
          fechaTurnoISO: x.fechaTurnoISO,
          createdAt: x.createdAt,
        })),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'Error al cargar', text: msg })
    }
  }, [monthStart, monthEnd])

  useEffect(() => {
    void loadCompanies()
  }, [loadCompanies])

  useEffect(() => {
    void loadMonth()
  }, [loadMonth])

  const monthTurnos = useMemo(() => {
    return turnos
      .slice()
      .sort((a, b) => {
        const byEmpresa = normalizeText(a.empresaNombre).localeCompare(normalizeText(b.empresaNombre))
        if (byEmpresa !== 0) return byEmpresa
        const byDate = (a.fechaTurnoISO || '').localeCompare(b.fechaTurnoISO || '')
        if (byDate !== 0) return byDate
        return (a.createdAt || '').localeCompare(b.createdAt || '')
      })
  }, [turnos])

  const monthCountsByDay = useMemo(() => {
    const m = new Map<string, number>()
    monthTurnos.forEach((t) => {
      const k = t.fechaTurnoISO
      if (!k) return
      m.set(k, (m.get(k) || 0) + 1)
    })
    return m
  }, [monthTurnos])

  const dayTurnos = useMemo(() => {
    if (!selectedDayISO) return []
    return monthTurnos.filter((t) => t.fechaTurnoISO === selectedDayISO)
  }, [monthTurnos, selectedDayISO])

  const setField = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((p) => ({ ...p, [key]: value }))
  }, [])

  const clearForm = useCallback(() => {
    setDraft((p) => ({
      ...p,
      empresaId: p.empresaId,
      dni: '',
      nombre: '',
      nacimientoISO: '',
      motivo: '',
      diagnostico: '',
      fechaTurnoISO: isoDay(new Date()),
    }))
  }, [])

  const validate = useCallback((): string | null => {
    if (!draft.empresaId) return 'Seleccioná una empresa.'
    if (!draft.dni.trim()) return 'Completá DNI.'
    if (!draft.nombre.trim()) return 'Completá Nombre y Apellido.'
    if (!draft.nacimientoISO) return 'Completá Nacimiento.'
    if (!draft.motivo.trim()) return 'Completá Motivo de consulta.'
    if (!draft.diagnostico.trim()) return 'Completá Diagnóstico.'
    if (!draft.fechaTurnoISO) return 'Completá la fecha del turno.'
    return null
  }, [draft])

  const takeTurno = useCallback(async () => {
    const err = validate()
    if (err) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: err, timer: 2300, showConfirmButton: false })
      return
    }

    const empresaNombre = selectedCompany?.nombre?.trim() || ''

    try {
      await createConsultorioTurno({
        companyId: draft.empresaId,
        dni: draft.dni.trim(),
        nombre: draft.nombre.trim(),
        nacimientoISO: draft.nacimientoISO,
        motivo: draft.motivo.trim(),
        diagnostico: draft.diagnostico.trim(),
        fechaTurnoISO: draft.fechaTurnoISO,
      })

      Swal.fire({
        icon: 'success',
        title: 'Turno guardado',
        text: `Se guardó para ${empresaNombre || 'la empresa seleccionada'}.`,
        timer: 1600,
        showConfirmButton: false,
      })

      clearForm()
      await loadMonth()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: msg })
    }
  }, [clearForm, draft, loadMonth, selectedCompany, validate])

  const goPrevMonth = useCallback(() => {
    if (monthIndex0 === 0) {
      setMonthIndex0(11)
      setYear(year - 1)
    } else {
      setMonthIndex0(monthIndex0 - 1)
    }
  }, [monthIndex0, year])

  const goNextMonth = useCallback(() => {
    if (monthIndex0 === 11) {
      setMonthIndex0(0)
      setYear(year + 1)
    } else {
      setMonthIndex0(monthIndex0 + 1)
    }
  }, [monthIndex0, year])

  const goToday = useCallback(() => {
    const d = new Date()
    setYear(d.getFullYear())
    setMonthIndex0(d.getMonth())
  }, [])

  // --- LOGICA DE DESCARGA PDF DIARIA O MENSUAL ---
  const downloadPdf = useCallback(() => {
    // Si hay un día seleccionado, imprimimos el reporte diario
    if (selectedDayISO) {
      const title = `Turnos del día ${selectedDayISO}`
      const doc = buildPdfConsultorios(dayTurnos, title)
      const file = `Consultorios_Dia_${selectedDayISO}.pdf`
      doc.save(file)
    } else {
      // Si no hay día, imprimimos el reporte mensual
      const title = `Turnos Mes: ${monthTitle}`
      const doc = buildPdfConsultorios(monthTurnos, title)
      const file = `Consultorios_Mes_${String(monthIndex0 + 1).padStart(2, '0')}-${year}.pdf`
      doc.save(file)
    }
  }, [selectedDayISO, dayTurnos, monthTurnos, monthTitle, monthIndex0, year])

  const grid = useMemo(() => {
    const first = new Date(year, monthIndex0, 1)
    const startDow = (first.getDay() + 6) % 7
    const totalDays = daysInMonth(year, monthIndex0)

    const cells: Array<{ iso: string | null; day: number | null }> = []
    for (let i = 0; i < startDow; i++) cells.push({ iso: null, day: null })
    for (let d = 1; d <= totalDays; d++) cells.push({ iso: ymd(year, monthIndex0, d), day: d })
    while (cells.length % 7 !== 0) cells.push({ iso: null, day: null })
    return cells
  }, [year, monthIndex0])

  const hasCompanies = !companiesLoading && activeCompanies.length > 0
  
  // Variables para controlar el estado del botón PDF
  const pdfButtonLabel = selectedDayISO ? 'PDF Día' : 'PDF Mes'
  const pdfButtonDisabled = selectedDayISO ? dayTurnos.length === 0 : monthTurnos.length === 0

  return (
    <div className="consultorios">
      <div className="consultorios__grid">
        <section className="card consultorios__card">
          <header className="consultorios__head">
            <div>
              <h2 className="consultorios__title">Consultorios</h2>
              <p className="consultorios__subtitle">Tomá turnos por empresa y dejá el diagnóstico registrado.</p>
            </div>
          </header>

          {companiesLoading ? (
            <div className="consultorios__empty">Cargando empresas…</div>
          ) : !hasCompanies ? (
            <div className="consultorios__empty">
              No hay empresas activas cargadas todavía. Agregalas desde <b>Cartilla de empresas</b> y volvé.
            </div>
          ) : (
            <div className="consultorios__form">
              <label className="consultorios__label consultorios__label--full">
                Empresa
                <select className="input" value={draft.empresaId} onChange={(e) => setField('empresaId', e.target.value)}>
                  <option value="">Seleccionar…</option>
                  {activeCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="consultorios__label">
                DNI
                <input className="input" value={draft.dni} onChange={(e) => setField('dni', e.target.value)} placeholder="Documento" />
              </label>

              <label className="consultorios__label">
                Nombre y Apellido
                <input className="input" value={draft.nombre} onChange={(e) => setField('nombre', e.target.value)} placeholder="Ej: Juan Pérez" />
              </label>

              <label className="consultorios__label">
                Nacimiento
                <input type="date" className="input" value={draft.nacimientoISO} onChange={(e) => setField('nacimientoISO', e.target.value)} />
              </label>

              <label className="consultorios__label">
                Fecha del turno
                <input type="date" className="input" value={draft.fechaTurnoISO} onChange={(e) => setField('fechaTurnoISO', e.target.value)} />
              </label>

              <label className="consultorios__label consultorios__label--full">
                Motivo de consulta
                <input className="input" value={draft.motivo} onChange={(e) => setField('motivo', e.target.value)} placeholder="Ej: Control / Dolor / Apto / etc." />
              </label>

              <label className="consultorios__label consultorios__label--full">
                Diagnóstico
                <textarea
                  className="input consultorios__textarea"
                  value={draft.diagnostico}
                  onChange={(e) => setField('diagnostico', e.target.value)}
                  placeholder="Escribí el diagnóstico…"
                  rows={4}
                />
              </label>

              <div className="consultorios__actions">
                <button type="button" className="btn btn--outline" onClick={clearForm}>
                  Limpiar
                </button>
                <button type="button" className="btn btn--primary" onClick={takeTurno}>
                  Tomar turno
                </button>
              </div>
            </div>
          )}
        </section>

        <section key={monthResetKey} className="card consultorios__month">
          <header className="consultorios__monthHead">
            <div>
              <h3 className="consultorios__monthTitle">Turnos del mes</h3>
              <div className="consultorios__monthSub">{monthTitle}</div>
            </div>

            <div className="consultorios__monthBtns">
              <button type="button" className="btn btn--outline btn--sm" onClick={goPrevMonth}>
                ‹
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={goToday}>
                Hoy
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={goNextMonth}>
                ›
              </button>

              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={downloadPdf}
                disabled={pdfButtonDisabled}
                title={pdfButtonDisabled ? 'No hay turnos para descargar' : `Descargar reporte (${selectedDayISO ? 'Día' : 'Mes'})`}
              >
                {pdfButtonLabel}
              </button>
            </div>
          </header>

          <div className="consultorios__calendar">
            <div className="consultorios__dow">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <div key={`${d}-${i}`} className="consultorios__dowCell">
                  {d}
                </div>
              ))}
            </div>

            <div className="consultorios__cells">
              {grid.map((c, idx) => {
                const count = c.iso ? monthCountsByDay.get(c.iso) || 0 : 0
                const isActive = Boolean(c.iso) && selectedDayISO === c.iso

                return (
                  <button
                    key={idx}
                    type="button"
                    className={
                      'consultorios__cell' +
                      (c.iso ? '' : ' consultorios__cell--empty') +
                      (isActive ? ' consultorios__cell--active' : '')
                    }
                    disabled={!c.iso}
                    onClick={() => {
                      const iso = c.iso
                      if (!iso) return
                      setSelectedDayISO((prev) => (prev === iso ? '' : iso))
                    }}
                  >
                    <div className="consultorios__dayNum">{c.day ?? ''}</div>
                    {count > 0 && <div className="consultorios__badge">{count}</div>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="consultorios__list">
            <div className="consultorios__listHead">
              <div className="consultorios__listTitle">
                {selectedDayISO ? (
                  <>
                    Turnos del día <b>{selectedDayISO}</b>
                  </>
                ) : (
                  <>
                    Turnos del mes: <b>{monthTurnos.length}</b>
                  </>
                )}
              </div>

              {selectedDayISO && (
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setSelectedDayISO('')}>
                  Ver mes
                </button>
              )}
            </div>

            <div className="consultorios__tableWrap">
              <table className="consultorios__table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Empresa</th>
                    <th>DNI</th>
                    <th>Nombre</th>
                    <th>Nac.</th>
                    <th>Motivo</th>
                    <th>Diagnóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedDayISO ? dayTurnos : monthTurnos).slice(0, 200).map((t) => (
                    <tr key={t.id}>
                      <td>{t.fechaTurnoISO}</td>
                      <td>{t.empresaNombre}</td>
                      <td>{t.dni}</td>
                      <td>{t.nombre}</td>
                      <td>{t.nacimientoISO}</td>
                      <td className="consultorios__cellText">{t.motivo}</td>
                      <td className="consultorios__cellText">{t.diagnostico}</td>
                    </tr>
                  ))}

                  {(selectedDayISO ? dayTurnos : monthTurnos).length === 0 && (
                    <tr>
                      <td colSpan={7} className="consultorios__noRows">
                        No hay turnos para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {(selectedDayISO ? dayTurnos : monthTurnos).length > 200 && (
              <div className="consultorios__hint">Mostrando 200 resultados. Ajustá el mes/día para ver más preciso.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}