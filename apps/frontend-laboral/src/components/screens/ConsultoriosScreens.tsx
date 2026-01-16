import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'

import { createConsultorioTurno, listConsultorios } from '@/api/consultoriosApi'
import {
  listCompanies,
  type Company as ApiCompany,
  getCompanyPadron,
  type CompanyPadronPerson,
} from '@/api/companiesApi'

type Company = ApiCompany

type ConsultorioTurno = {
  id: string
  empresaId: string
  empresaNombre: string

  dni: string
  nombre: string
  nacimientoISO: string
  diagnostico: string

  fechaTurnoISO: string
  createdAt: string
}

type Draft = {
  empresaId: string
  dni: string
  nombre: string
  nacimientoISO: string
  diagnostico: string
  fechaTurnoISO: string
}

const STORAGE_KEY_CONSULTORIOS_DRAFT = 'medic_laboral_consultorios_draft_v1'

// ✅ Buenos Aires timezone
const TZ_AR = 'America/Argentina/Buenos_Aires'

// ✅ YYYY-MM-DD (en zona horaria Buenos Aires)
function isoDayAR(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_AR,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)

  const yyyy = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const mm = parts.find((p) => p.type === 'month')?.value ?? '00'
  const dd = parts.find((p) => p.type === 'day')?.value ?? '00'
  return `${yyyy}-${mm}-${dd}`
}

// ✅ ISO -> DD/MM/YYYY (Argentina)
function fmtArgDate(isoYmd: string): string {
  const [y, m, d] = (isoYmd || '').split('-')
  if (!y || !m || !d) return isoYmd || '-'
  return `${d}/${m}/${y}`
}

// ✅ ISO -> DD-MM-YYYY (para nombre de archivo)
function fmtArgDateFile(isoYmd: string): string {
  const [y, m, d] = (isoYmd || '').split('-')
  if (!y || !m || !d) return isoYmd || 'fecha'
  return `${d}-${m}-${y}`
}

// ✅ Mes/Año (ARG) -> MM-YYYY (para nombre de archivo)
function fmtMonthYearFile(year: number, monthIndex0: number): string {
  const mm = String(monthIndex0 + 1).padStart(2, '0')
  return `${mm}-${year}`
}

function safeFilePart(s: string): string {
  return (s || '')
    .trim()
    .replaceAll(' ', '_')
    .replace(/[\\/:*?"<>|]+/g, '-') // inválidos Windows
    .replace(/_+/g, '_')
}

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function normalizeDni(s: string) {
  return (s || '').replace(/\D/g, '')
}

function safeLoadDraft(todayISO: string): Draft {
  const fallback: Draft = {
    empresaId: '',
    dni: '',
    nombre: '',
    nacimientoISO: '',
    diagnostico: '',
    fechaTurnoISO: todayISO, // ✅ SIEMPRE HOY
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONSULTORIOS_DRAFT)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Draft>

    // ✅ aunque venga guardado, FORZAMOS HOY
    return {
      ...fallback,
      ...parsed,
      fechaTurnoISO: todayISO,
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
  // (esto es solo UI; el nombre del archivo lo hacemos con fmtMonthYearFile)
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

function buildPdfConsultorios(turnosList: ConsultorioTurno[]) {
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

  const empresas = Array.from(byEmpresa.keys()).sort((a, b) =>
    normalizeText(a).localeCompare(normalizeText(b)),
  )

  let y = margin

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
      { x: margin + 46, w: 58, label: 'Nombre' },
      { x: margin + 106, w: 24, label: ' ' },
      { x: margin + 80, w: pageW - margin - (margin + 80), label: 'Diagnóstico' },
    ]
    cols.forEach((c) => doc.text(c.label, c.x, y))

    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.2)
    doc.line(margin, y, pageW - margin, y)
    y += 5

    list.forEach((t) => {
      const linesDiag = doc.splitTextToSize(t.diagnostico || '-', cols[4].w)
      const linesNombre = doc.splitTextToSize(t.nombre || '-', cols[2].w)

      const rowH = Math.max(linesDiag.length, linesNombre.length, 1) * 4.2
      ensureSpace(rowH + 6)

      // ✅ Fecha en formato Argentina dentro del PDF
      doc.text(t.fechaTurnoISO ? fmtArgDate(t.fechaTurnoISO) : '-', cols[0].x, y)
      doc.text(t.dni || '-', cols[1].x, y)
      doc.text(linesNombre, cols[2].x, y)
      doc.text(linesDiag, cols[4].x, y)

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

/** Busca un DNI en el padrón de empresas activas (con cache + concurrencia). */
async function findPersonByDniAcrossCompanies(opts: {
  dni: string
  companies: Company[]
  padronCache: Map<string, CompanyPadronPerson[]>
  padronCacheSet: React.Dispatch<React.SetStateAction<Map<string, CompanyPadronPerson[]>>>
}): Promise<
  | null
  | {
      company: Company
      person: CompanyPadronPerson
    }
> {
  const dni = normalizeDni(opts.dni)
  if (dni.length < 7) return null

  const actives = (opts.companies || []).filter((c) => c.isActive)
  if (actives.length === 0) return null

  // ✅ primero: buscamos en cache
  for (const c of actives) {
    const cached = opts.padronCache.get(c.id)
    if (cached && cached.length) {
      const hit = cached.find((p) => normalizeDni(p.dni) === dni)
      if (hit) return { company: c, person: hit }
    }
  }

  // ✅ luego: fetch concurrente, cortando al primer match
  let found: { company: Company; person: CompanyPadronPerson } | null = null
  let idx = 0
  const limit = 4

  const workers = new Array(Math.min(limit, actives.length)).fill(0).map(async () => {
    while (idx < actives.length && !found) {
      const my = idx++
      const c = actives[my]

      // si ya hay cache vacía, evitamos pegarle de nuevo
      if (opts.padronCache.has(c.id)) continue

      try {
        const r = await getCompanyPadron(c.id)
        const items = (r.items || []).slice()

        // guardamos cache (aunque venga vacío)
        opts.padronCacheSet((prev) => {
          const next = new Map(prev)
          next.set(c.id, items)
          return next
        })

        if (!found) {
          const hit = items.find((p) => normalizeDni(p.dni) === dni)
          if (hit) found = { company: c, person: hit }
        }
      } catch {
        // cacheamos vacío para no insistir infinito
        opts.padronCacheSet((prev) => {
          const next = new Map(prev)
          next.set(c.id, [])
          return next
        })
      }
    }
  })

  await Promise.all(workers)
  return found
}

export default function ConsultoriosScreen() {
  // ✅ HOY calculado en zona horaria Buenos Aires (UTC-3)
  const todayISO = useMemo(() => isoDayAR(new Date()), [])

  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(true)

  const [turnos, setTurnos] = useState<ConsultorioTurno[]>([])
  const [draft, setDraft] = useState<Draft>(() => safeLoadDraft(todayISO))

  // ✅ cache de padrón por empresa (para autocompletar por DNI)
  const [padronCache, setPadronCache] = useState<Map<string, CompanyPadronPerson[]>>(() => new Map())
  const padronCacheRef = useRef<Map<string, CompanyPadronPerson[]>>(new Map())
  useEffect(() => {
    padronCacheRef.current = padronCache
  }, [padronCache])

  const searchingRef = useRef(false)
  const lastAutoDniRef = useRef<string>('')

  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [monthIndex0, setMonthIndex0] = useState(now.getMonth())

  const monthTitle = useMemo(() => fmtMonthTitle(year, monthIndex0), [year, monthIndex0])

  // ✅ siempre guardar draft, pero con fecha forzada a hoy (AR)
  useEffect(() => {
    if (draft.fechaTurnoISO !== todayISO) {
      setDraft((p) => ({ ...p, fechaTurnoISO: todayISO }))
      return
    }
    safeSaveDraft(draft)
  }, [draft, todayISO])

  const activeCompanies = useMemo(() => {
    const list = companies.slice()
    list.sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)))
    return list.filter((c) => c.isActive)
  }, [companies])

  const selectedCompany = useMemo(() => {
    return activeCompanies.find((c) => c.id === draft.empresaId) || null
  }, [activeCompanies, draft.empresaId])

  const monthResetKey = useMemo(() => `${year}-${monthIndex0}`, [year, monthIndex0])
  const [selectedDayISO, setSelectedDayISO] = useState<string>('')

  // ✅ filtro de empresa para reportes/listado (independiente del formulario)
  const [reportCompanyId, setReportCompanyId] = useState<string>('')

  const reportCompany = useMemo(() => {
    if (!reportCompanyId) return null
    return activeCompanies.find((c) => c.id === reportCompanyId) || null
  }, [activeCompanies, reportCompanyId])

  const monthStart = useMemo(() => ymd(year, monthIndex0, 1), [year, monthIndex0])
  const monthEnd = useMemo(() => ymd(year, monthIndex0, daysInMonth(year, monthIndex0)), [year, monthIndex0])

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

  // ✅ aplica filtro de empresa al listado (mes o día)
  const baseForReport = useMemo(() => {
    return selectedDayISO ? dayTurnos : monthTurnos
  }, [selectedDayISO, dayTurnos, monthTurnos])

  const reportTurnos = useMemo(() => {
    if (!reportCompanyId) return baseForReport
    return baseForReport.filter((t) => t.empresaId === reportCompanyId)
  }, [baseForReport, reportCompanyId])

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
      diagnostico: '',
      fechaTurnoISO: isoDayAR(new Date()), // ✅ hoy AR
    }))
    lastAutoDniRef.current = ''
  }, [])

  const validate = useCallback((): string | null => {
    if (!draft.empresaId) return 'Seleccioná una empresa.'
    if (!draft.dni.trim()) return 'Completá DNI.'
    if (!draft.nombre.trim()) return 'Completá Nombre y Apellido.'
    if (!draft.nacimientoISO) return 'Completá Nacimiento.'
    if (!draft.diagnostico.trim()) return 'Completá Diagnóstico.'
    if (!draft.fechaTurnoISO) return 'Completá la fecha del turno.'
    return null
  }, [draft])

  // ✅ AUTOCOMPLETAR por DNI (empresa + nombre) buscando en padrón
  useEffect(() => {
    const dni = normalizeDni(draft.dni)
    if (dni.length < 7) return

    if (lastAutoDniRef.current === dni) return
    if (searchingRef.current) return

    searchingRef.current = true

    ;(async () => {
      try {
        const hit = await findPersonByDniAcrossCompanies({
          dni,
          companies: activeCompanies,
          padronCache: padronCacheRef.current,
          padronCacheSet: setPadronCache,
        })

        if (!hit) return

        lastAutoDniRef.current = dni

        setDraft((p) => ({
          ...p,
          empresaId: hit.company.id,
          nombre: (hit.person.nombre || '').trim() || p.nombre,
        }))

        Swal.fire({
          icon: 'info',
          title: 'Encontrado en padrón',
          text: `${(hit.person.nombre || 'Persona').toString()} · ${hit.company.nombre}`,
          timer: 1400,
          showConfirmButton: false,
        })
      } finally {
        searchingRef.current = false
      }
    })()
  }, [draft.dni, activeCompanies])

  const takeTurno = useCallback(async () => {
    // ✅ fecha HOY AR
    const fechaHoy = isoDayAR(new Date())
    if (draft.fechaTurnoISO !== fechaHoy) {
      setDraft((p) => ({ ...p, fechaTurnoISO: fechaHoy }))
    }

    const err = validate()
    if (err) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: err, timer: 2300, showConfirmButton: false })
      return
    }

    const empresaNombre = selectedCompany?.nombre?.trim() || ''

    try {
      await createConsultorioTurno({
        companyId: draft.empresaId,
        dni: normalizeDni(draft.dni),
        nombre: draft.nombre.trim(),
        nacimientoISO: draft.nacimientoISO,
        diagnostico: draft.diagnostico.trim(),
        fechaTurnoISO: fechaHoy, // ✅ HOY SIEMPRE (AR)
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

  // ✅ nombre archivo:
  // - Día:  Empresa + DD-MM-YYYY
  // - Mes:  Empresa + MM-YYYY
  const downloadPdf = useCallback(() => {
    const empresaLabel = reportCompany?.nombre?.trim() || 'Todas'
    const empresaPart = safeFilePart(empresaLabel)

    const doc = buildPdfConsultorios(reportTurnos)

    if (selectedDayISO) {
      const dayArg = fmtArgDateFile(selectedDayISO) // DD-MM-YYYY
      doc.save(`${empresaPart}_${dayArg}.pdf`)
    } else {
      const my = fmtMonthYearFile(year, monthIndex0) // MM-YYYY
      doc.save(`${empresaPart}_${my}.pdf`)
    }
  }, [selectedDayISO, reportTurnos, monthIndex0, year, reportCompany])

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

  const pdfButtonLabel = selectedDayISO ? 'PDF Día' : 'PDF Mes'
  const pdfButtonDisabled = reportTurnos.length === 0

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
                <input
                  className="input"
                  value={draft.dni}
                  onChange={(e) => setField('dni', e.target.value)}
                  placeholder="Documento"
                  inputMode="numeric"
                />
              </label>

              <label className="consultorios__label">
                Nombre y Apellido
                <input
                  className="input"
                  value={draft.nombre}
                  onChange={(e) => setField('nombre', e.target.value)}
                  placeholder="Ej: Juan Pérez"
                />
              </label>

              <label className="consultorios__label">
                Nacimiento
                <input type="date" className="input" value={draft.nacimientoISO} onChange={(e) => setField('nacimientoISO', e.target.value)} />
              </label>

              <label className="consultorios__label">
                Fecha del turno
                <input
                  type="date"
                  className="input"
                  value={draft.fechaTurnoISO}
                  disabled
                  title="Demanda espontánea: los turnos son siempre para hoy"
                  onChange={() => {
                    // noop (lock)
                  }}
                />
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

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'flex-end' }}>
            <label className="consultorios__label" style={{ margin: 0, flex: '1 1 260px' }}>
              Filtrar por empresa (reporte/listado)
              <select className="input" value={reportCompanyId} onChange={(e) => setReportCompanyId(e.target.value)}>
                <option value="">Todas las empresas</option>
                {activeCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setReportCompanyId('')}
              disabled={!reportCompanyId}
              title={!reportCompanyId ? 'Ya estás viendo todas' : 'Quitar filtro'}
              style={{ height: 34 }}
            >
              Limpiar filtro
            </button>

            <div style={{ color: 'var(--color-ink-soft)', fontSize: '.9rem', paddingBottom: 6 }}>
              Mostrando: <b>{reportTurnos.length}</b> turnos
              {reportCompany ? (
                <>
                  {' '}· Empresa: <b>{reportCompany.nombre}</b>
                </>
              ) : (
                <> · Empresa: <b>Todas</b></>
              )}
            </div>
          </div>

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
                    Turnos del día <b>{fmtArgDate(selectedDayISO)}</b>
                    {reportCompany ? (
                      <>
                        {' '}· Empresa: <b>{reportCompany.nombre}</b>
                      </>
                    ) : (
                      <> · Empresa: <b>Todas</b></>
                    )}
                  </>
                ) : (
                  <>
                    Turnos del mes: <b>{reportTurnos.length}</b>
                    {reportCompany ? (
                      <>
                        {' '}· Empresa: <b>{reportCompany.nombre}</b>
                      </>
                    ) : (
                      <> · Empresa: <b>Todas</b></>
                    )}
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
                    <th>Diagnóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {reportTurnos.slice(0, 200).map((t) => (
                    <tr key={t.id}>
                      <td>{t.fechaTurnoISO ? fmtArgDate(t.fechaTurnoISO) : '-'}</td>
                      <td>{t.empresaNombre}</td>
                      <td>{t.dni}</td>
                      <td>{t.nombre}</td>
                      <td>{t.nacimientoISO}</td>
                      <td className="consultorios__cellText">{t.diagnostico}</td>
                    </tr>
                  ))}

                  {reportTurnos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="consultorios__noRows">
                        No hay turnos para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {reportTurnos.length > 200 && (
              <div className="consultorios__hint">Mostrando 200 resultados. Ajustá el mes/día/filtro para ver más preciso.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
