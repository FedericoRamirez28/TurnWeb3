import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import escobaPng from '@/assets/icons/escoba.png'
import { laboralTurnoDelete } from '@/api/laboralTurnosApi'
import { listCompanies, type Company } from '@/api/companiesApi'

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
const PREOCUPACIONAL_ROUTE = '/preocupacional'
const FIXED_TURNO_HORA = '08:00'

function savePreocupacionalPrefill(payload: PreocupacionalPrefill) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFILL, JSON.stringify(payload))
  } catch {
    // no-op
  }
}

const ADICIONALES_CONCEPTO: string[] = [
  'Preocupacional / Basico de ley',
  'Periódico',
  'Egreso',
  'Femenino',
  'Masculino',
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

async function listLaborTurnos(params: { q?: string; from?: string; to?: string; month?: string }): Promise<ListLaborTurnosResponse> {
  const usp = new URLSearchParams()
  if (params.q && params.q.trim()) usp.set('q', params.q.trim())
  if (params.from) usp.set('from', params.from)
  if (params.to) usp.set('to', params.to)
  if (params.month) usp.set('month', params.month)

  const qs = usp.toString()
  return fetchJson<ListLaborTurnosResponse>(`/laboral/turnos${qs ? `?${qs}` : ''}`, { method: 'GET' })
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
    horaTurno: FIXED_TURNO_HORA,
    puesto: '',
    tipoExamen: '',
  }))

  const [pickedExams, setPickedExams] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const [examQ, setExamQ] = useState('')
  const [serverAdicionales, setServerAdicionales] = useState<string[]>([])

  const [viewFrom, setViewFrom] = useState('')
  const [viewTo, setViewTo] = useState('')
  const [smartQ, setSmartQ] = useState('')
  const [viewerTurnos, setViewerTurnos] = useState<LaborTurno[]>([])
  const [viewerLoading, setViewerLoading] = useState(false)

  const [cancelMode, setCancelMode] = useState(false)

  const viewerAbortRef = useRef<AbortController | null>(null)
  const viewerReqSeqRef = useRef(0)

  // ✅ Cartilla de empresas para autocompletar
  const [companies, setCompanies] = useState<Company[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const autoCompanyIdRef = useRef<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setCompaniesLoading(true)
        const r = await listCompanies({ q: '', filter: 'actives' })
        if (!alive) return
        setCompanies(Array.isArray(r.items) ? r.items : [])
      } catch {
        if (!alive) return
        setCompanies([])
      } finally {
        if (!alive) return
        setCompaniesLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  function findCompanyByExactName(name: string) {
    const key = normalizeText(name)
    if (!key) return null
    return companies.find((c) => normalizeText(c.nombre) === key) ?? null
  }

  function applyCompanyAutofill(name: string) {
    const c = findCompanyByExactName(name)
    if (!c) {
      autoCompanyIdRef.current = null
      return
    }

    setDraft((p) => ({
      ...p,
      empresa: c.nombre,
      nroAfiliado: (c.nroSocio ?? '').toString(),
    }))
    autoCompanyIdRef.current = c.id
  }

  useEffect(() => {
    setServerAdicionales([])
  }, [])

  useEffect(() => {
    setDraft((p) => ({ ...p, tipoExamen: pickedExams.join(' + ') }))
  }, [pickedExams])

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
    autoCompanyIdRef.current = null
    setDraft((p) => ({
      ...p,
      nombre: '',
      empresa: '',
      nroAfiliado: '',
      dni: '',
      fechaRecepcionISO: isoDay(new Date()),
      fechaTurnoISO: '',
      horaTurno: FIXED_TURNO_HORA,
      puesto: '',
      tipoExamen: '',
    }))
    setPickedExams([])
    setExamQ('')
  }

  function validate(): string | null {
    if (!draft.nombre.trim()) return 'Completá Nombre y apellido.'
    if (!draft.empresa.trim()) return 'Completá Empresa.'
    if (!draft.dni.trim()) return 'Completá DNI.'
    if (!draft.fechaRecepcionISO) return 'Completá la fecha de recepción.'
    if (!draft.fechaTurnoISO) return 'Completá la fecha real del turno.'
    if (!draft.puesto.trim()) return 'Completá Puesto a ocupar.'
    if (!draft.tipoExamen.trim()) return 'Seleccioná al menos un Tipo de examen.'
    return null
  }

  const addExam = (val: string) => {
    if (!val) return
    if (!pickedExams.includes(val)) setPickedExams((prev) => [...prev, val])
  }

  const removeExam = (val: string) => {
    setPickedExams((prev) => prev.filter((x) => x !== val))
  }

  async function takeTurno() {
    const err = validate()
    if (err) {
      Swal.fire({ icon: 'warning', title: 'Faltan datos', text: err, timer: 2200, showConfirmButton: false })
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
        tipoExamen: draft.tipoExamen.trim(),
        fechaRecepcionISO: draft.fechaRecepcionISO,
        fechaTurnoISO: draft.fechaTurnoISO,
        horaTurno: FIXED_TURNO_HORA,
      }

      await createLaborTurno(payload)

      Swal.fire({
        icon: 'success',
        title: 'Turno tomado',
        text: `Se guardó el turno ${draft.fechaTurnoISO} ${FIXED_TURNO_HORA} (${draft.sede === 'caba' ? 'CABA' : 'San Justo'}).`,
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
        normalizeText(msg).includes('exists') ||
        normalizeText(msg).includes('ocupado')

      Swal.fire({
        icon: looksLikeDup ? 'info' : 'error',
        title: looksLikeDup ? 'No se pudo tomar' : 'Error',
        text: msg,
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
            const byDate = dayPart(a.fechaTurnoISO || '').localeCompare(dayPart(b.fechaTurnoISO || ''))
            if (byDate !== 0) return byDate
            return (a.createdAt || '').localeCompare(b.createdAt || '')
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
        normalizeText(t.horaTurno || FIXED_TURNO_HORA)

      return hay.includes(qq)
    })
  }, [viewerTurnos, smartQ, viewFrom, viewTo, hasViewerFilters])

  const shouldShowResults = hasViewerFilters && filteredTurnos.length > 0

  function clearViewer() {
    setViewFrom('')
    setViewTo('')
    setSmartQ('')
    setViewerTurnos([])
    setCancelMode(false)
  }

  function goToPreocupacionalFromTurno(t: LaborTurno) {
    const payload: PreocupacionalPrefill = {
      empresa: t.empresa || '',
      nroAfiliado: t.nroAfiliado || '',
      nombre: t.nombre || '',
      dni: t.dni || '',
      puesto: t.puesto || '',
      examen: t.tipoExamen || '',
      examKey: 'preocupacional',
      focusTab: t.tipoExamen ? 'adicionales' : 'planilla',
    }

    savePreocupacionalPrefill(payload)
    navigate(PREOCUPACIONAL_ROUTE, { state: payload })
  }

  async function cancelTurnoRow(t: LaborTurno) {
    if (busy) return

    const r = await Swal.fire({
      icon: 'warning',
      title: 'Cancelar turno',
      html: `Se va a <b>borrar</b> el turno:<br/><br/>
            <b>${dayPart(t.fechaTurnoISO || '')} ${t.horaTurno || FIXED_TURNO_HORA}</b><br/>
            ${t.empresa} · ${t.nombre} · DNI ${t.dni}<br/>
            <span style="color:#64748b">${t.tipoExamen}</span>`,
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'No',
      confirmButtonColor: '#dc2626',
    })

    if (!r.isConfirmed) return

    setBusy(true)
    try {
      await laboralTurnoDelete(t.id)

      Swal.fire({
        icon: 'success',
        title: 'Turno cancelado',
        text: 'Se borró el turno correctamente.',
        timer: 1400,
        showConfirmButton: false,
      })

      setViewerTurnos((prev) => prev.filter((x) => x.id !== t.id))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'No se pudo cancelar', text: msg })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="labor-turnos card card--stretch">
      <header className="card__header labor-turnos__header">
        <div>
          <h2 className="card__title">Toma de turnos laborales</h2>
          <p className="card__subtitle">
            Todos los turnos preocupacionales se toman a las <b>{FIXED_TURNO_HORA}</b>. Se listan por <b>orden de llamado</b>.
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
              Empresa
              <input
                className="input"
                value={draft.empresa}
                placeholder="Ej: Implatell"
                disabled={busy}
                list="companies_datalist"
                onChange={(e) => {
                  const v = e.target.value
                  setField('empresa', v)

                  const c = findCompanyByExactName(v)
                  if (c) {
                    setDraft((p) => ({
                      ...p,
                      empresa: c.nombre,
                      nroAfiliado: (c.nroSocio ?? '').toString(),
                    }))
                    autoCompanyIdRef.current = c.id
                  } else {
                    autoCompanyIdRef.current = null
                  }
                }}
                onBlur={() => {
                  applyCompanyAutofill(draft.empresa)
                }}
              />

              <datalist id="companies_datalist">
                {companies.map((c) => (
                  <option key={c.id} value={c.nombre} />
                ))}
              </datalist>

              {companiesLoading && (
                <small className="field__hint" style={{ marginTop: 6, display: 'block', color: 'var(--color-ink-soft)' }}>
                  Cargando cartilla…
                </small>
              )}
            </label>

            <label className="labor-turnos__label">
              Nombre y apellido
              <input className="input" value={draft.nombre} onChange={(e) => setField('nombre', e.target.value)} placeholder="Ej: Juan Pérez" disabled={busy} />
            </label>

            <label className="labor-turnos__label">
              N° afiliado (opcional)
              <input
                className="input"
                value={draft.nroAfiliado}
                onChange={(e) => {
                  autoCompanyIdRef.current = null
                  setField('nroAfiliado', e.target.value)
                }}
                placeholder="Si no tiene, dejar vacío"
                disabled={busy}
              />
            </label>

            <label className="labor-turnos__label">
              DNI
              <input className="input" value={draft.dni} onChange={(e) => setField('dni', e.target.value)} placeholder="Documento" inputMode="numeric" disabled={busy} />
            </label>

            <label className="labor-turnos__label">
              Fecha recepcionado
              <input type="date" className="input" value={draft.fechaRecepcionISO} onChange={(e) => setField('fechaRecepcionISO', e.target.value)} disabled={busy} />
            </label>

            <label className="labor-turnos__label">
              Fecha real del turno
              <input
                type="date"
                className="input"
                value={draft.fechaTurnoISO}
                onChange={(e) => {
                  setField('fechaTurnoISO', e.target.value)
                  setField('horaTurno', FIXED_TURNO_HORA)
                }}
                disabled={busy}
              />
            </label>

            <label className="labor-turnos__label">
              Horario
              <input className="input" value={FIXED_TURNO_HORA} disabled />
              <small className="field__hint" style={{ marginTop: 6, display: 'block', color: 'var(--color-ink-soft)' }}>
                Fijo para todos los preocupacionales.
              </small>
            </label>

            <label className="labor-turnos__label labor-turnos__label--full">
              Puesto a ocupar
              <input className="input" value={draft.puesto} onChange={(e) => setField('puesto', e.target.value)} placeholder="Ej: Operario / Chofer / Administrativo…" disabled={busy} />
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
                <input className="input" value={examQ} onChange={(e) => setExamQ(e.target.value)} placeholder="Filtrar lista…" disabled={busy} />
                <select className="input" value="" onChange={(e) => addExam(e.target.value)} disabled={busy}>
                  <option value="">Agregar examen...</option>
                  {examenOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

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
                  Usá rango de fechas o búsqueda (empresa / DNI / nombre). Se ordenan por <b>orden de llamado</b>.
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
                <input className="input" value={smartQ} onChange={(e) => setSmartQ(e.target.value)} placeholder="Buscar por empresa, DNI, nombre, examen, puesto…" disabled={busy} />
              </label>
            </div>

            {!hasViewerFilters && (
              <div className="labor-turnos__viewer-empty">
                Tip: para ver turnos, cargá <b>Desde/Hasta</b> o escribí algo en <b>Búsqueda inteligente</b>.
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
                  {cancelMode && <span style={{ marginLeft: 10, color: '#b91c1c', fontWeight: 700 }}>· Modo cancelar activo</span>}
                </div>

                <div className="labor-turnos__viewer-tableWrap">
                  <table className="labor-turnos__viewer-table">
                    <thead>
                      <tr>
                        {cancelMode && <th style={{ width: 72 }}>Cancelar</th>}
                        <th>#</th>
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
                      {filteredTurnos.slice(0, 50).map((t, idx) => (
                        <tr
                          key={t.id}
                          className="labor-turnos__clickRow"
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (cancelMode) return
                            goToPreocupacionalFromTurno(t)
                          }}
                          onKeyDown={(e) => {
                            if (cancelMode) return
                            if (e.key === 'Enter' || e.key === ' ') goToPreocupacionalFromTurno(t)
                          }}
                          title={cancelMode ? 'Modo cancelar activo' : 'Abrir y autorrellenar Preocupacional'}
                          style={cancelMode ? { cursor: 'default' } : undefined}
                        >
                          {cancelMode && (
                            <td>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  void cancelTurnoRow(t)
                                }}
                                disabled={busy}
                                title="Cancelar / borrar turno"
                                aria-label="Cancelar / borrar turno"
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 999,
                                  border: '1px solid rgba(220,38,38,.28)',
                                  background: 'rgba(220,38,38,.08)',
                                  color: '#b91c1c',
                                  fontWeight: 900,
                                  cursor: 'pointer',
                                }}
                              >
                                ✕
                              </button>
                            </td>
                          )}

                          <td>{idx + 1}</td>
                          <td>{dayPart(t.fechaTurnoISO || '')}</td>
                          <td>{t.horaTurno || FIXED_TURNO_HORA}</td>
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

                {filteredTurnos.length > 50 && <div className="labor-turnos__viewer-hint">Mostrando 50 resultados. Ajustá filtros para ver más preciso.</div>}
              </div>
            )}
          </div>
        </div>

        <div className="labor-turnos__footer">
          <button
            type="button"
            className={'btn btn--outline'}
            onClick={() => setCancelMode((v) => !v)}
            disabled={busy || !shouldShowResults}
            title={shouldShowResults ? 'Activar/desactivar modo cancelar' : 'Primero buscá turnos para poder cancelar'}
          >
            {cancelMode ? 'Salir de cancelar' : 'Cancelar turnos'}
          </button>

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
