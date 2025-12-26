import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import escobaPng from '@/assets/icons/escoba.png'

type SedeKey = 'caba' | 'sanjusto'

type LaborTurno = {
  id: string
  sede: SedeKey
  empresa: string
  companyId: string
  employeeId: string
  nombre: string
  dni: string
  nroAfiliado: string
  puesto: string
  fechaRecepcionISO: string
  fechaTurnoISO: string
  tipoExamen: string
  createdAt: string
  horaTurno?: string
}

type PreocupacionalPrefill = {
  empresa?: string
  nroAfiliado?: string
  nombre?: string
  dni?: string
  puesto?: string
  examen?: string
  examKey?: 'preocupacional' | 'periodico' | 'egreso'
  focusTab?: 'planilla' | 'adicionales' | 'clasificacion'
}

type Draft = {
  sede: SedeKey
  nombre: string
  empresa: string
  nroAfiliado: string
  dni: string
  fechaRecepcionISO: string
  fechaTurnoISO: string
  horaTurno: string
  puesto: string
  tipoExamen: string
}

const STORAGE_KEY_PREFILL = 'medic_laboral_preocupacional_prefill_v1'

function savePreocupacionalPrefill(payload: PreocupacionalPrefill) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFILL, JSON.stringify(payload))
  } catch {
    // no-op
  }
}

const PREOCUPACIONAL_ROUTE = '/preocupacional'

const ADICIONALES_CONCEPTO: string[] = [
  'Preocupacional, periódico o egreso, Básico de Ley, Masculino y Femenino',
  'Psicotécnico',
  'Psicotécnico para trabajos en Altura / Manejo de Autoelevadores / Clarkista',
  'Evaluación Neurológica (Requiere turno previo)',
  'Electroencefalografía (Requiere turno previo)',
  'Ergometría (Requiere turno previo)',
  'Rx. Col. Lumbosacra F y P (2)',
  'Rx. Col. Cervical F y P (2)',
  'Audiometría',
  'Sub Unidad Beta',
  'Cocaína',
  'Marihuana',
  'HIV',
  'EEG con informe',
  'Espirometría',
  'Consulta Clínica Médica en Consultorio',
  'Control de Ausentismo hasta 40 km CABA Final',
  'Control de Ausentismo KM Excedente C/U',
]

const ADICIONALES_LAB: string[] = [
  'Grupo y Factor (C/U)',
  'Colesterol Total',
  'HDL',
  'LDL',
  'Triglicéridos',
  'Reacción de Huddleson',
  'V.D.R.L',
  'Hepatograma',
  'TSH',
  'T3',
  'T4',
]

const ADICIONALES_BASE = [...ADICIONALES_CONCEPTO, ...ADICIONALES_LAB]

function isoDay(d = new Date()) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function dayPart(iso: string) {
  return (iso || '').slice(0, 10)
}

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function inRangeISO(dateISO: string, fromISO: string, toISO: string) {
  if (!dateISO) return false
  if (fromISO && dateISO < fromISO) return false
  if (toISO && dateISO > toISO) return false
  return true
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function pickErrorMessage(data: unknown, status: number): string {
  if (typeof data === 'string' && data.trim()) return data
  if (isRecord(data)) {
    const msg = data.message
    const err = data.error
    const detail = data.detail
    if (typeof msg === 'string' && msg.trim()) return msg
    if (typeof err === 'string' && err.trim()) return err
    if (typeof detail === 'string' && detail.trim()) return detail
  }
  return `HTTP ${status}`
}

function buildApiBase() {
  const v = import.meta.env?.VITE_API_BASE_URL
  if (typeof v === 'string' && v.trim()) return v.trim().replace(/\/$/, '')
  return ''
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = buildApiBase()
  const url = path.startsWith('http') ? path : `${base}${path}`

  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  })

  const text = await res.text()

  let data: unknown = null
  try {
    data = text ? (JSON.parse(text) as unknown) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    throw new Error(pickErrorMessage(data, res.status))
  }

  return data as T
}

type CreateLaborTurnoResponse = { turno: LaborTurno }
type ListLaborTurnosResponse = { turnos: LaborTurno[] }

async function createLaborTurno(payload: {
  sede: SedeKey
  empresa: string
  nombre: string
  dni: string
  nroAfiliado?: string
  puesto: string
  tipoExamen: string
  fechaRecepcionISO: string
  fechaTurnoISO: string
  horaTurno: string
}): Promise<CreateLaborTurnoResponse> {
  return fetchJson<CreateLaborTurnoResponse>('/laboral/turnos', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

async function listLaborTurnos(params: {
  q?: string
  from?: string
  to?: string
  month?: string
}): Promise<ListLaborTurnosResponse> {
  const usp = new URLSearchParams()
  if (params.q && params.q.trim()) usp.set('q', params.q.trim())
  if (params.from) usp.set('from', params.from)
  if (params.to) usp.set('to', params.to)
  if (params.month) usp.set('month', params.month)

  const qs = usp.toString()
  return fetchJson<ListLaborTurnosResponse>(`/laboral/turnos${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  })
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

export function TurnosLaboralCard() {
  const navigate = useNavigate()

  const [draft, setDraft] = useState<Draft>(() => ({
    sede: 'caba',
    nombre: '',
    empresa: '',
    nroAfiliado: '',
    dni: '',
    fechaRecepcionISO: isoDay(new Date()),
    fechaTurnoISO: '',
    horaTurno: '',
    puesto: '',
    tipoExamen: '',
  }))

  // Nuevo estado para manejar múltiples exámenes seleccionados
  const [pickedExams, setPickedExams] = useState<string[]>([])

  const [busy, setBusy] = useState(false)

  const [examQ, setExamQ] = useState('')
  const [serverAdicionales, setServerAdicionales] = useState<string[]>([])

  const [viewFrom, setViewFrom] = useState('')
  const [viewTo, setViewTo] = useState('')
  const [smartQ, setSmartQ] = useState('')
  const [viewerTurnos, setViewerTurnos] = useState<LaborTurno[]>([])
  const [viewerLoading, setViewerLoading] = useState(false)

  const viewerAbortRef = useRef<AbortController | null>(null)
  const viewerReqSeqRef = useRef(0)

  const [dayTurnos, setDayTurnos] = useState<LaborTurno[]>([])
  const [dayTurnosLoading, setDayTurnosLoading] = useState(false)
  const lastWarnedRef = useRef<string>('')

  useEffect(() => {
    setServerAdicionales([])
  }, [])

  // Efecto para sincronizar la lista de seleccionados con el string del draft
  // Se unen con " + " para que se guarde como un solo string en la DB y pase a la otra pantalla
  useEffect(() => {
    setDraft((p) => ({ ...p, tipoExamen: pickedExams.join(' + ') }))
  }, [pickedExams])

  const slotOptions = useMemo(() => buildTimeSlots(8, 18, 30), [])

  const examenOptions = useMemo(() => {
    const all = [...ADICIONALES_BASE, ...(serverAdicionales || [])]

    const seen = new Set<string>()
    const uniq: string[] = []
    for (const it of all) {
      const k = normalizeText(it)
      if (!k) continue
      if (seen.has(k)) continue
      seen.add(k)
      uniq.push(it)
    }

    const qq = normalizeText(examQ)
    if (!qq) return uniq
    return uniq.filter((x) => normalizeText(x).includes(qq))
  }, [examQ, serverAdicionales])

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((p) => ({ ...p, [key]: value }))
  }

  function clearSelection() {
    setDraft((p) => ({
      ...p,
      nombre: '',
      empresa: '',
      nroAfiliado: '',
      dni: '',
      fechaRecepcionISO: isoDay(new Date()),
      fechaTurnoISO: '',
      horaTurno: '',
      puesto: '',
      tipoExamen: '',
    }))
    // Limpiamos también la lista de multiples
    setPickedExams([])
    setExamQ('')
    setDayTurnos([])
    setDayTurnosLoading(false)
    lastWarnedRef.current = ''
  }

  function validate(): string | null {
    if (!draft.nombre.trim()) return 'Completá Nombre y apellido.'
    if (!draft.empresa.trim()) return 'Completá Empresa.'
    if (!draft.dni.trim()) return 'Completá DNI.'
    if (!draft.fechaRecepcionISO) return 'Completá la fecha de recepción.'
    if (!draft.fechaTurnoISO) return 'Completá la fecha real del turno.'
    if (!draft.horaTurno) return 'Seleccioná el horario del turno.'
    if (!draft.puesto.trim()) return 'Completá Puesto a ocupar.'
    if (!draft.tipoExamen.trim()) return 'Seleccioná al menos un Tipo de examen.'
    return null
  }

  // Funciones helpers para agregar/quitar exámenes
  const addExam = (val: string) => {
    if (!val) return
    // Evitamos duplicados exactos
    if (!pickedExams.includes(val)) {
      setPickedExams((prev) => [...prev, val])
    }
  }

  const removeExam = (val: string) => {
    setPickedExams((prev) => prev.filter((x) => x !== val))
  }

  const occupiedKey = useMemo(() => {
    if (!draft.fechaTurnoISO || !draft.horaTurno) return ''
    return `${draft.fechaTurnoISO}__${draft.horaTurno}__${draft.sede}`
  }, [draft.fechaTurnoISO, draft.horaTurno, draft.sede])

  const isSlotOccupied = useMemo(() => {
    if (!draft.fechaTurnoISO || !draft.horaTurno) return false
    const day = draft.fechaTurnoISO
    const h = draft.horaTurno
    return dayTurnos.some((t) => dayPart(t.fechaTurnoISO || '') === day && (t.horaTurno || '') === h && t.sede === draft.sede)
  }, [dayTurnos, draft.fechaTurnoISO, draft.horaTurno, draft.sede])

  useEffect(() => {
    const day = draft.fechaTurnoISO
    if (!day) {
      setDayTurnos([])
      setDayTurnosLoading(false)
      return
    }

    let alive = true
    setDayTurnosLoading(true)

    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const r = await listLaborTurnos({ from: day, to: day })
          const list = Array.isArray(r.turnos) ? r.turnos.slice() : []
          const dayList = list.filter((x) => dayPart(x.fechaTurnoISO || '') === day)
          dayList.sort((a, b) => {
            const ha = (a.horaTurno || '').localeCompare(b.horaTurno || '')
            if (ha !== 0) return ha
            return normalizeText(a.empresa || '').localeCompare(normalizeText(b.empresa || ''))
          })
          if (alive) setDayTurnos(dayList)
        } catch {
          if (alive) setDayTurnos([])
        } finally {
          if (alive) setDayTurnosLoading(false)
        }
      })()
    }, 220)

    return () => {
      alive = false
      window.clearTimeout(t)
    }
  }, [draft.fechaTurnoISO])

  useEffect(() => {
    if (!occupiedKey) return
    if (!isSlotOccupied) return
    if (lastWarnedRef.current === occupiedKey) return

    lastWarnedRef.current = occupiedKey
    void Swal.fire({
      icon: 'info',
      title: 'Horario ocupado',
      text: 'Ese horario ya tiene un turno cargado. Elegí otro horario.',
      timer: 2200,
      showConfirmButton: false,
    })
    setField('horaTurno', '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupiedKey, isSlotOccupied])

  async function takeTurno() {
    const err = validate()
    if (err) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: err,
        timer: 2200,
        showConfirmButton: false,
      })
      return
    }

    if (isSlotOccupied) {
      Swal.fire({
        icon: 'info',
        title: 'Horario ocupado',
        text: 'Ese horario ya tiene un turno cargado. Elegí otro horario.',
      })
      return
    }

    setBusy(true)
    try {
      const payload = {
        sede: draft.sede,
        empresa: draft.empresa.trim(),
        nombre: draft.nombre.trim(),
        dni: draft.dni.trim(),
        nroAfiliado: draft.nroAfiliado.trim() || undefined,
        puesto: draft.puesto.trim(),
        tipoExamen: draft.tipoExamen.trim(), // Esto ya lleva el string unido "Exam1 + Exam2"
        fechaRecepcionISO: draft.fechaRecepcionISO,
        fechaTurnoISO: draft.fechaTurnoISO,
        horaTurno: draft.horaTurno,
      }

      await createLaborTurno(payload)

      Swal.fire({
        icon: 'success',
        title: 'Turno tomado',
        text: `Se guardó el turno ${draft.fechaTurnoISO} ${draft.horaTurno} (${draft.sede === 'caba' ? 'CABA' : 'San Justo'}).`,
        timer: 1600,
        showConfirmButton: false,
      })

      clearSelection()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      const looksLikeDup =
        normalizeText(msg).includes('duplicate') ||
        normalizeText(msg).includes('unique') ||
        normalizeText(msg).includes('ya existe') ||
        normalizeText(msg).includes('exists')

      Swal.fire({
        icon: looksLikeDup ? 'info' : 'error',
        title: looksLikeDup ? 'Ya existe' : 'Error',
        text: looksLikeDup ? 'Ese turno laboral ya estaba cargado (evitamos duplicados).' : msg,
      })
    } finally {
      setBusy(false)
    }
  }

  const hasViewerFilters = Boolean(normalizeText(smartQ)) || Boolean(viewFrom) || Boolean(viewTo)

  useEffect(() => {
    if (!hasViewerFilters) {
      setViewerTurnos([])
      setViewerLoading(false)
      viewerAbortRef.current?.abort()
      viewerAbortRef.current = null
      return
    }

    const seq = ++viewerReqSeqRef.current

    viewerAbortRef.current?.abort()
    const ac = new AbortController()
    viewerAbortRef.current = ac

    const run = async () => {
      setViewerLoading(true)

      let shouldStop = false
      try {
        const r = await listLaborTurnos({ q: smartQ, from: viewFrom, to: viewTo })

        if (ac.signal.aborted || seq !== viewerReqSeqRef.current) {
          shouldStop = true
        } else {
          const items = Array.isArray(r.turnos) ? r.turnos.slice() : []

          items.sort((a, b) => {
            const byDate = dayPart(b.fechaTurnoISO || '').localeCompare(dayPart(a.fechaTurnoISO || ''))
            if (byDate !== 0) return byDate
            const hb = (b.horaTurno || '').localeCompare(a.horaTurno || '')
            if (hb !== 0) return hb
            return (b.createdAt || '').localeCompare(a.createdAt || '')
          })

          setViewerTurnos(items)
        }
      } catch {
        if (ac.signal.aborted || seq !== viewerReqSeqRef.current) {
          shouldStop = true
        } else {
          setViewerTurnos([])
        }
      } finally {
        if (!shouldStop && !ac.signal.aborted && seq === viewerReqSeqRef.current) {
          setViewerLoading(false)
        }
      }
    }

    const t = window.setTimeout(() => void run(), 250)
    return () => window.clearTimeout(t)
  }, [hasViewerFilters, smartQ, viewFrom, viewTo])

  const filteredTurnos = useMemo(() => {
    if (!hasViewerFilters) return []
    const qq = normalizeText(smartQ)

    return viewerTurnos.filter((t) => {
      const d = dayPart(t.fechaTurnoISO || '')
      if (!inRangeISO(d, viewFrom, viewTo)) return false
      if (!qq) return true

      const hay =
        normalizeText(t.empresa) +
        ' ' +
        normalizeText(t.dni) +
        ' ' +
        normalizeText(t.nombre) +
        ' ' +
        normalizeText(t.nroAfiliado || '') +
        ' ' +
        normalizeText(t.tipoExamen) +
        ' ' +
        normalizeText(t.puesto || '') +
        ' ' +
        normalizeText(t.sede) +
        ' ' +
        normalizeText(t.horaTurno || '')

      return hay.includes(qq)
    })
  }, [viewerTurnos, smartQ, viewFrom, viewTo, hasViewerFilters])

  const shouldShowResults = hasViewerFilters && filteredTurnos.length > 0

  function clearViewer() {
    setViewFrom('')
    setViewTo('')
    setSmartQ('')
    setViewerTurnos([])
  }

  function goToPreocupacionalFromTurno(t: LaborTurno) {
    const payload: PreocupacionalPrefill = {
      empresa: t.empresa || '',
      nroAfiliado: t.nroAfiliado || '',
      nombre: t.nombre || '',
      dni: t.dni || '',
      puesto: t.puesto || '',
      examen: t.tipoExamen || '', // Aquí viaja el string unido "Exam1 + Exam2"
      examKey: 'preocupacional',
      focusTab: t.tipoExamen ? 'adicionales' : 'planilla',
    }

    savePreocupacionalPrefill(payload)
    navigate(PREOCUPACIONAL_ROUTE, { state: payload })
  }

  return (
    <section className="labor-turnos card card--stretch">
      <header className="card__header labor-turnos__header">
        <div>
          <h2 className="card__title">Toma de turnos laborales</h2>
          <p className="card__subtitle">
            Cargá el turno y presioná <b>Tomar turno</b>.
          </p>
        </div>

        <div className="labor-turnos__tools">
          <button
            type="button"
            className="labor-turnos__icon-btn"
            onClick={clearSelection}
            title="Limpiar selección"
            aria-label="Limpiar selección"
            disabled={busy}
          >
            <img src={escobaPng} alt="" />
          </button>
        </div>
      </header>

      <div className="labor-turnos__top">
        <div className="labor-turnos__tabsRow">
          <div className="labor-turnos__tabs" role="tablist" aria-label="Sedes turnos laborales">
            <button
              type="button"
              className={'labor-turnos__tab' + (draft.sede === 'caba' ? ' labor-turnos__tab--active' : '')}
              onClick={() => setField('sede', 'caba')}
              disabled={busy}
            >
              CABA
            </button>
            <button
              type="button"
              className={'labor-turnos__tab' + (draft.sede === 'sanjusto' ? ' labor-turnos__tab--active' : '')}
              onClick={() => setField('sede', 'sanjusto')}
              disabled={busy}
            >
              San Justo
            </button>
          </div>
        </div>
      </div>

      <div className="labor-turnos__body">
        <div className="labor-turnos__scroller">
          <div className="labor-turnos__grid">
            <label className="labor-turnos__label">
              Nombre y apellido
              <input
                className="input"
                value={draft.nombre}
                onChange={(e) => setField('nombre', e.target.value)}
                placeholder="Ej: Juan Pérez"
                disabled={busy}
              />
            </label>

            <label className="labor-turnos__label">
              Empresa
              <input
                className="input"
                value={draft.empresa}
                onChange={(e) => setField('empresa', e.target.value)}
                placeholder="Ej: Implatell"
                disabled={busy}
              />
            </label>

            <label className="labor-turnos__label">
              N° afiliado (opcional)
              <input
                className="input"
                value={draft.nroAfiliado}
                onChange={(e) => setField('nroAfiliado', e.target.value)}
                placeholder="Si no tiene, dejar vacío"
                disabled={busy}
              />
            </label>

            <label className="labor-turnos__label">
              DNI
              <input
                className="input"
                value={draft.dni}
                onChange={(e) => setField('dni', e.target.value)}
                placeholder="Documento"
                inputMode="numeric"
                disabled={busy}
              />
            </label>

            <label className="labor-turnos__label">
              Fecha recepcionado
              <input
                type="date"
                className="input"
                value={draft.fechaRecepcionISO}
                onChange={(e) => setField('fechaRecepcionISO', e.target.value)}
                disabled={busy}
              />
            </label>

            <label className="labor-turnos__label">
              Fecha real del turno
              <input
                type="date"
                className="input"
                value={draft.fechaTurnoISO}
                onChange={(e) => {
                  setField('fechaTurnoISO', e.target.value)
                  setField('horaTurno', '')
                }}
                disabled={busy}
              />
            </label>

            <label className="labor-turnos__label">
              Horario
              <select
                className="input"
                value={draft.horaTurno}
                onChange={(e) => setField('horaTurno', e.target.value)}
                disabled={busy || !draft.fechaTurnoISO}
              >
                <option value="">{draft.fechaTurnoISO ? 'Seleccionar…' : 'Elegí fecha primero…'}</option>
                {slotOptions.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>

              {draft.fechaTurnoISO && (
                <small className="field__hint" style={{ marginTop: 6, display: 'block', color: 'var(--color-ink-soft)' }}>
                  {dayTurnosLoading ? 'Chequeando disponibilidad…' : isSlotOccupied ? 'Ocupado' : 'Disponible'}
                </small>
              )}
            </label>

            <label className="labor-turnos__label labor-turnos__label--full">
              Puesto a ocupar
              <input
                className="input"
                value={draft.puesto}
                onChange={(e) => setField('puesto', e.target.value)}
                placeholder="Ej: Operario / Chofer / Administrativo…"
                disabled={busy}
              />
            </label>

            <div className="labor-turnos__exam">
              <div className="labor-turnos__exam-head">
                <div className="labor-turnos__exam-left">
                  <div className="labor-turnos__exam-title">Tipo de examen</div>
                  <div className="labor-turnos__exam-sub">Seleccioná uno o más ítems.</div>
                </div>

                <div className="labor-turnos__exam-actions">
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    onClick={() => {
                      setExamQ('')
                      setPickedExams([])
                    }}
                    disabled={busy}
                  >
                    Limpiar exámenes
                  </button>
                </div>
              </div>

              <div className="labor-turnos__exam-row">
                <input
                  className="input"
                  value={examQ}
                  onChange={(e) => setExamQ(e.target.value)}
                  placeholder="Filtrar lista…"
                  disabled={busy}
                />

                <select
                  className="input"
                  value="" // Siempre reset para poder agregar otro
                  onChange={(e) => addExam(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Agregar examen...</option>
                  {examenOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              {/* LISTA DE ITEMS SELECCIONADOS (TAGS) */}
              {pickedExams.length > 0 && (
                <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {pickedExams.map((ex) => (
                    <span
                      key={ex}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '16px',
                        backgroundColor: '#eef2ff',
                        color: '#3730a3',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        border: '1px solid #c7d2fe',
                      }}
                    >
                      {ex}
                      <button
                        type="button"
                        onClick={() => removeExam(ex)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#4f46e5',
                          fontWeight: 'bold',
                          padding: 0,
                          marginLeft: 2,
                          lineHeight: 1,
                        }}
                        title="Quitar"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="labor-turnos__viewer">
            <div className="labor-turnos__viewer-head">
              <div>
                <div className="labor-turnos__viewer-title">Ver turnos tomados</div>
                <div className="labor-turnos__viewer-sub">
                  Usá rango de fechas o búsqueda (empresa / DNI / nombre). Los resultados aparecen solo si hay coincidencias.
                </div>
              </div>

              <div className="labor-turnos__viewer-actions">
                <button type="button" className="btn btn--outline btn--sm" onClick={clearViewer} disabled={busy}>
                  Limpiar
                </button>
              </div>
            </div>

            <div className="labor-turnos__viewer-filters">
              <label className="labor-turnos__label">
                Desde
                <input type="date" className="input" value={viewFrom} onChange={(e) => setViewFrom(e.target.value)} disabled={busy} />
              </label>

              <label className="labor-turnos__label">
                Hasta
                <input type="date" className="input" value={viewTo} onChange={(e) => setViewTo(e.target.value)} disabled={busy} />
              </label>

              <label className="labor-turnos__label labor-turnos__label--full">
                Búsqueda inteligente
                <input
                  className="input"
                  value={smartQ}
                  onChange={(e) => setSmartQ(e.target.value)}
                  placeholder="Buscar por empresa, DNI, nombre, examen, puesto…"
                  disabled={busy}
                />
              </label>
            </div>

            {!hasViewerFilters && (
              <div className="labor-turnos__viewer-empty">
                Tip: para ver turnos, cargá <b>Desde/Hasta</b> o escribí algo en <b>Búsqueda inteligente</b>. Cuando haya coincidencias, aparecen abajo.
              </div>
            )}

            {hasViewerFilters && viewerLoading && <div className="labor-turnos__viewer-empty">Buscando turnos…</div>}

            {hasViewerFilters && !viewerLoading && !shouldShowResults && (
              <div className="labor-turnos__viewer-empty">Sin coincidencias para los filtros actuales.</div>
            )}

            {shouldShowResults && (
              <div className="labor-turnos__viewer-results">
                <div className="labor-turnos__viewer-meta">
                  Coincidencias: <b>{filteredTurnos.length}</b>
                </div>

                <div className="labor-turnos__viewer-tableWrap">
                  <table className="labor-turnos__viewer-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Empresa</th>
                        <th>Nombre</th>
                        <th>DNI</th>
                        <th>Examen</th>
                        <th>Sede</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTurnos.slice(0, 50).map((t) => (
                        <tr
                          key={t.id}
                          className="labor-turnos__clickRow"
                          role="button"
                          tabIndex={0}
                          onClick={() => goToPreocupacionalFromTurno(t)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') goToPreocupacionalFromTurno(t)
                          }}
                          title="Abrir y autorrellenar Preocupacional"
                        >
                          <td>{dayPart(t.fechaTurnoISO || '')}</td>
                          <td>{t.horaTurno || '-'}</td>
                          <td>{t.empresa}</td>
                          <td>{t.nombre}</td>
                          <td>{t.dni}</td>
                          <td className="labor-turnos__viewer-exam">{t.tipoExamen}</td>
                          <td>{t.sede === 'caba' ? 'CABA' : 'San Justo'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredTurnos.length > 50 && (
                  <div className="labor-turnos__viewer-hint">Mostrando 50 resultados. Ajustá filtros para ver más preciso.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="labor-turnos__footer">
          <button type="button" className="btn btn--outline" onClick={clearSelection} disabled={busy}>
            Limpiar selección
          </button>
          <button type="button" className="btn btn--primary" onClick={takeTurno} disabled={busy}>
            {busy ? 'Procesando…' : 'Tomar turno'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default TurnosLaboralCard