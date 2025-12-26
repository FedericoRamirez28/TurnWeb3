import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'

type ExamKey = 'preocupacional' | 'periodico' | 'egreso'
type ViewKey = 'planilla' | 'adicionales' | 'clasificacion'
type ClasifKey = 'A' | 'B' | 'C' | 'D' | 'E'

type Draft = {
  empresa: string
  nroAfiliado: string
  nombre: string
  dni: string
  puesto: string
  checks: Record<ExamKey, boolean>

  clasificacion: ClasifKey
  observaciones: string[]
  notificado: boolean

  adicionalesSelected: string[]
}

type PreocupacionalPrefill = {
  empresa?: string
  nroAfiliado?: string
  nombre?: string
  dni?: string
  puesto?: string
  examen?: string
  examKey?: ExamKey
  focusTab?: ViewKey
}

type TurnoLaboral = {
  empresa?: string
  nroAfiliado?: string
  nombre?: string
  dni?: string
  puesto?: string
  tipoExamen?: string
}

type TurnoLaboralNavState =
  | PreocupacionalPrefill
  | {
      fromTurnoLaboral?: boolean
      turno?: TurnoLaboral
    }

const STORAGE_KEY_DRAFT = 'medic_laboral_preocupacional_draft_v3'
const STORAGE_KEY_PREFILL = 'medic_laboral_preocupacional_prefill_v1'

function getApiBase(): string {
  const env = import.meta.env as Record<string, string | undefined>
  const base = env.VITE_API_BASE_URL
  if (!base) throw new Error('Falta VITE_API_BASE_URL en .env')
  return base.replace(/\/$/, '')
}

function loadDraft(): Draft {
  const fallback: Draft = {
    empresa: '',
    nroAfiliado: '',
    nombre: '',
    dni: '',
    puesto: '',
    checks: { preocupacional: false, periodico: false, egreso: false },

    clasificacion: 'C',
    observaciones: [''],
    notificado: false,

    adicionalesSelected: [],
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRAFT)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Draft>
    return {
      ...fallback,
      ...parsed,
      checks: { ...fallback.checks, ...(parsed.checks || {}) },
      observaciones:
        Array.isArray(parsed.observaciones) && parsed.observaciones.length
          ? parsed.observaciones
          : fallback.observaciones,
      clasificacion: (parsed.clasificacion as ClasifKey) || fallback.clasificacion,
      notificado: Boolean(parsed.notificado),
      adicionalesSelected: Array.isArray(parsed.adicionalesSelected) ? parsed.adicionalesSelected : [],
    }
  } catch {
    return fallback
  }
}

function fmtDate(d = new Date()) {
  return d.toLocaleDateString()
}

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

const ADICIONALES_ALL = [...ADICIONALES_CONCEPTO, ...ADICIONALES_LAB]

function drawCheckbox(doc: jsPDF, x: number, y: number, label: string, checked: boolean) {
  doc.rect(x, y, 6, 6)
  if (checked) {
    doc.setFont('helvetica', 'bold')
    doc.text('X', x + 1.6, y + 5)
    doc.setFont('helvetica', 'normal')
  }
  doc.text(label, x + 9, y + 5)
}

function buildPdfPlanilla(draft: Draft) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('EXAMEN MEDICO', margin, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(fmtDate(new Date()), pageW - margin, 18, { align: 'right' })

  const y0 = 30
  doc.setFontSize(10)

  doc.text('EMPRESA:', margin, y0)
  doc.text(draft.empresa || ' ', margin + 26, y0)

  doc.text('N° AFILIADO:', pageW / 2 + 20, y0)
  doc.text(draft.nroAfiliado || ' ', pageW / 2 + 46, y0)

  doc.text('NOMBRE Y APELLIDO:', margin, y0 + 12)
  doc.text(draft.nombre || ' ', margin + 45, y0 + 12)

  doc.text('DNI:', pageW / 2 + 20, y0 + 12)
  doc.text(draft.dni || ' ', pageW / 2 + 30, y0 + 12)

  doc.text('PUESTO A OCUPAR:', margin, y0 + 24)
  doc.text(draft.puesto || ' ', margin + 36, y0 + 24)

  const cy = y0 + 46
  doc.setFontSize(10)
  drawCheckbox(doc, margin, cy, 'Examen Preocupacional', draft.checks.preocupacional)
  drawCheckbox(doc, margin + 70, cy, 'Examen Periodico', draft.checks.periodico)
  drawCheckbox(doc, margin + 132, cy, 'Examen Egreso', draft.checks.egreso)

  const sy = 255
  doc.setDrawColor(0)
  doc.line(margin, sy, margin + 70, sy)
  doc.line(pageW - margin - 70, sy, pageW - margin, sy)

  doc.setFontSize(10)
  doc.text('FIRMA DEL TRABAJADOR', margin + 35, sy + 8, { align: 'center' })
  doc.text('FIRMA DEL MEDICO', pageW - margin - 35, sy + 8, { align: 'center' })

  return doc
}

function buildPdfClasificacion(draft: Draft) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('CLASIFICACION', margin, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(fmtDate(new Date()), pageW - margin, 18, { align: 'right' })

  const y = 36
  const items: { k: ClasifKey; title: string; sub: string }[] = [
    { k: 'A', title: 'A', sub: 'SIN INCAPACIDAD' },
    { k: 'B', title: 'B', sub: 'SIN INCAPACIDAD' },
    { k: 'C', title: 'C', sub: 'SIN INCAPACIDAD' },
    { k: 'D', title: 'D', sub: 'CON LIMITACION' },
    { k: 'E', title: 'E', sub: 'NO APTO' },
  ]

  const boxW = (pageW - margin * 2 - 8 * 4) / 5
  let x = margin
  items.forEach((it, idx) => {
    doc.rect(x, y, boxW, 22)
    doc.setFont('helvetica', 'bold')
    doc.text(it.title, x + 4, y + 7)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(it.sub, x + boxW / 2, y + 18, { align: 'center' })

    doc.setFontSize(11)
    const mark = draft.clasificacion === it.k ? 'X' : '-'
    doc.text(`( ${mark} )`, x + boxW - 14, y + 7)

    x += boxW + (idx < 4 ? 8 : 0)
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Observaciones:', margin, 72)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const obs = draft.observaciones.map((s) => s.trim()).filter(Boolean)
  let oy = 82
  const maxW = pageW - margin * 2
  if (!obs.length) {
    doc.text('-', margin, oy)
    oy += 6
  } else {
    obs.forEach((line) => {
      const wrapped = doc.splitTextToSize(`• ${line}`, maxW)
      doc.text(wrapped, margin, oy)
      oy += wrapped.length * 5 + 1
    })
  }

  const legend =
    'Por la presente me notifico de mis afecciones detectadas en el presente examen en un total acuerdo al art. 6 inc. 3 de la Ley 24557 de Accidentes de Trabajo.'
  const legendLines = doc.splitTextToSize(legend, maxW)
  const ly = Math.max(oy + 10, 210)

  doc.setFontSize(9.5)
  doc.text(legendLines, margin, ly)

  doc.rect(margin, ly + legendLines.length * 5 + 6, 6, 6)
  if (draft.notificado) {
    doc.setFont('helvetica', 'bold')
    doc.text('X', margin + 1.6, ly + legendLines.length * 5 + 11)
    doc.setFont('helvetica', 'normal')
  }
  doc.setFontSize(10)
  doc.text('Notificado / Conforme', margin + 10, ly + legendLines.length * 5 + 11)

  const sy = 275
  doc.setDrawColor(0)
  doc.line(margin, sy, margin + 80, sy)
  doc.line(pageW - margin - 80, sy, pageW - margin, sy)
  doc.setFontSize(10)
  doc.text('FIRMA DEL TRABAJADOR', margin + 40, sy + 7, { align: 'center' })
  doc.text('FIRMA DEL MEDICO', pageW - margin - 40, sy + 7, { align: 'center' })

  return doc
}

function isPreocupacionalPrefill(x: unknown): x is PreocupacionalPrefill {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    'empresa' in o ||
    'dni' in o ||
    'nombre' in o ||
    'puesto' in o ||
    'examen' in o ||
    'examKey' in o ||
    'focusTab' in o ||
    'nroAfiliado' in o
  )
}

export default function PreocupacionalScreen() {
  const location = useLocation()

  useEffect(() => {
  // ✅ si el componente no se desmonta entre navegaciones, permitimos re-aplicar
  prefillAppliedRef.current = false
}, [location.key])


  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [view, setView] = useState<ViewKey>('planilla')

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const [adQ, setAdQ] = useState('')

  const today = useMemo(() => fmtDate(new Date()), [])
  const todayISO = useMemo(() => isoDay(new Date()), [])

  const currentDoc = useCallback(() => {
    return view === 'clasificacion' ? buildPdfClasificacion(draft) : buildPdfPlanilla(draft)
  }, [draft, view])

  const setPdfPreview = useCallback((doc: jsPDF) => {
    try {
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = url
      setPreviewUrl(url)
      return
    } catch {
      const dataUri = doc.output('datauristring')
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setPreviewUrl(dataUri)
    }
  }, [])

  const openPreview = useCallback(() => {
    setPreviewOpen(true)
    setPdfPreview(currentDoc())
  }, [currentDoc, setPdfPreview])

  const closePreview = useCallback(() => {
    setPreviewOpen(false)
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setPreviewUrl(null)
  }, [])

  const togglePreview = useCallback(() => {
    if (previewOpen) closePreview()
    else openPreview()
  }, [previewOpen, closePreview, openPreview])

  const handleDownload = useCallback(() => {
    const doc = currentDoc()
    const suffix = view === 'clasificacion' ? 'Clasificacion' : 'Planilla'
    const safeName =
      (draft.nombre || 'examen')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w-]/g, '')
        .slice(0, 40) || 'examen'

    doc.save(`${suffix}_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }, [currentDoc, view, draft.nombre])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draft))
    } catch {
      // no-op
    }
  }, [draft])

  useEffect(() => {
    if (!previewOpen) return
    const t = window.setTimeout(() => setPdfPreview(currentDoc()), 200)
    return () => window.clearTimeout(t)
  }, [draft, previewOpen, view, currentDoc, setPdfPreview])

  function toggleCheck(key: ExamKey) {
    setDraft((p) => ({ ...p, checks: { ...p.checks, [key]: !p.checks[key] } }))
  }

  function updateField<K extends keyof Omit<Draft, 'checks' | 'observaciones' | 'adicionalesSelected'>>(
    key: K,
    value: Draft[K],
  ) {
    setDraft((p) => ({ ...p, [key]: value }))
  }

  function setObs(i: number, v: string) {
    setDraft((p) => {
      const next = [...p.observaciones]
      next[i] = v
      return { ...p, observaciones: next }
    })
  }

  function addObs() {
    setDraft((p) => ({ ...p, observaciones: [...p.observaciones, ''] }))
  }

  function removeObs(i: number) {
    setDraft((p) => {
      const next = p.observaciones.filter((_, idx) => idx !== i)
      return { ...p, observaciones: next.length ? next : [''] }
    })
  }

  function clearPlanillaSelection() {
    setDraft((p) => ({
      ...p,
      empresa: '',
      nroAfiliado: '',
      nombre: '',
      dni: '',
      puesto: '',
      checks: { preocupacional: false, periodico: false, egreso: false },
    }))
  }

  function clearClasificacionSelection() {
    setDraft((p) => ({
      ...p,
      clasificacion: 'C',
      observaciones: [''],
      notificado: false,
    }))
  }

  const prefillAppliedRef = useRef(false)

  const safeReadPrefillFromStorage = useCallback((): PreocupacionalPrefill | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PREFILL)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (!isPreocupacionalPrefill(parsed)) return null
      return parsed
    } catch {
      return null
    }
  }, [])

  const safeClearPrefillStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_PREFILL)
    } catch {
      // no-op
    }
  }, [])

  const coercePrefill = useCallback((state: unknown): PreocupacionalPrefill | null => {
    if (!state) return null

    if (isPreocupacionalPrefill(state)) return state

    if (typeof state !== 'object') return null
    const maybe = state as { turno?: TurnoLaboral }
    if (!maybe.turno) return null

    return {
      empresa: maybe.turno.empresa || '',
      nroAfiliado: maybe.turno.nroAfiliado || '',
      nombre: maybe.turno.nombre || '',
      dni: maybe.turno.dni || '',
      puesto: maybe.turno.puesto || '',
      examen: maybe.turno.tipoExamen || '',
      examKey: 'preocupacional',
      focusTab: maybe.turno.tipoExamen ? 'adicionales' : 'planilla',
    }
  }, [])

  useEffect(() => {
    if (prefillAppliedRef.current) return

    const fromStateRaw = (location.state ?? null) as TurnoLaboralNavState | null
    const fromState = coercePrefill(fromStateRaw)
    const fromStorage = safeReadPrefillFromStorage()
    const payload = fromState || fromStorage
    if (!payload) return

    prefillAppliedRef.current = true
    safeClearPrefillStorage()

    const examKey: ExamKey = payload.examKey || 'preocupacional'
    const incomingExam = (payload.examen || '').trim()

    const t = window.setTimeout(() => {
      setDraft((p) => {
        const nextChecks: Record<ExamKey, boolean> = {
          preocupacional: false,
          periodico: false,
          egreso: false,
        }
        nextChecks[examKey] = true

        const mergedAdicionales = (() => {
          if (!incomingExam) return p.adicionalesSelected
          const set = new Set(p.adicionalesSelected)
          set.add(incomingExam)
          return Array.from(set)
        })()

        const pick = (incoming: unknown, prev: string) => {
  if (typeof incoming !== 'string') return prev
  const v = incoming.trim()
  return v ? v : prev
}

return {
  ...p,
  empresa: pick(payload.empresa, p.empresa),
  nroAfiliado: pick(payload.nroAfiliado, p.nroAfiliado),
  nombre: pick(payload.nombre, p.nombre),
  dni: pick(payload.dni, p.dni),
  puesto: pick(payload.puesto, p.puesto),
  checks: nextChecks,
  adicionalesSelected: mergedAdicionales,
}

      })

      if (payload.focusTab) setView(payload.focusTab)
      else if (incomingExam) setView('adicionales')
      else setView('planilla')

      if (incomingExam) setAdQ(incomingExam)
    }, 0)

    return () => window.clearTimeout(t)
  }, [location.state, coercePrefill, safeReadPrefillFromStorage, safeClearPrefillStorage])

  const filteredAdicionales = useMemo(() => {
    const qq = normalizeText(adQ)
    if (!qq) return ADICIONALES_ALL
    return ADICIONALES_ALL.filter((x) => normalizeText(x).includes(qq))
  }, [adQ])

  function toggleAdicional(name: string) {
    setDraft((p) => {
      const has = p.adicionalesSelected.includes(name)
      const next = has ? p.adicionalesSelected.filter((x) => x !== name) : [...p.adicionalesSelected, name]
      return { ...p, adicionalesSelected: next }
    })
  }

  function clearAdicionalesSelection() {
    setDraft((p) => ({ ...p, adicionalesSelected: [] }))
  }

  async function saveAdicionales() {
    const empresa = draft.empresa.trim()
    const nroAfiliado = draft.nroAfiliado.trim()
    const nombre = draft.nombre.trim()
    const dni = draft.dni.trim()

    if (!empresa || !nombre || !dni) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completá al menos Empresa, Nombre y DNI antes de guardar adicionales.',
        timer: 2200,
        showConfirmButton: false,
      })
      return
    }

    const selected = draft.adicionalesSelected
    if (!selected.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sin adicionales',
        text: 'Tildá al menos un adicional.',
        timer: 1800,
        showConfirmButton: false,
      })
      return
    }

    const payload = selected.map((ad) => ({
      empresa,
      nroAfiliado: nroAfiliado || null,
      nombre,
      dni,
      adicional: ad,
      fechaISO: todayISO,
    }))

    try {
      const base = getApiBase()

      const res = await fetch(`${base}/laboral/adicionales/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'dev-user',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`API ${res.status} ${txt}`.trim())
      }

      const data = (await res.json()) as { inserted: number }

      if ((data.inserted ?? 0) <= 0) {
        Swal.fire({
          icon: 'info',
          title: 'Ya estaban guardados',
          text: 'No se agregaron nuevos adicionales (evitamos duplicados).',
          timer: 2000,
          showConfirmButton: false,
        })
        return
      }

      Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: `Se guardaron ${data.inserted} adicional(es).`,
        timer: 1600,
        showConfirmButton: false,
      })

      clearAdicionalesSelection()
      setAdQ('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar',
        text: msg,
      })
    }
  }

  return (
    <div className="preocupacional">
      <div className="card preocupacional__card">
        <div className="preocupacional__header">
          <div>
            <h2 className="preocupacional__title">Examen médico</h2>
            <p className="preocupacional__subtitle">Planilla Preocupacional</p>
          </div>
          <span className="preocupacional__date">{today}</span>
        </div>

        <div className="preocupacional__tabs" role="tablist" aria-label="Vistas examen">
          <button
            type="button"
            className={'preocupacional__tab' + (view === 'planilla' ? ' preocupacional__tab--active' : '')}
            onClick={() => setView('planilla')}
          >
            Planilla
          </button>

          <button
            type="button"
            className={'preocupacional__tab' + (view === 'adicionales' ? ' preocupacional__tab--active' : '')}
            onClick={() => setView('adicionales')}
          >
            Adicionales
          </button>

          <button
            type="button"
            className={'preocupacional__tab' + (view === 'clasificacion' ? ' preocupacional__tab--active' : '')}
            onClick={() => setView('clasificacion')}
          >
            Clasificación
          </button>
        </div>

        <div className="preocupacional__body">
          {view === 'planilla' ? (
            <>
              <div className="preocupacional__ad-actions" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                <button className="btn btn--outline" type="button" onClick={clearPlanillaSelection}>
                  Limpiar selección
                </button>
              </div>

              <div className="preocupacional__row preocupacional__row--two">
                <label className="preocupacional__label">
                  Empresa
                  <input className="input" value={draft.empresa} onChange={(e) => updateField('empresa', e.target.value)} />
                </label>

                <label className="preocupacional__label">
                  Número de afiliado
                  <input
                    className="input"
                    value={draft.nroAfiliado}
                    onChange={(e) => updateField('nroAfiliado', e.target.value)}
                  />
                </label>
              </div>

              <div className="preocupacional__row preocupacional__row--two">
                <label className="preocupacional__label">
                  Nombre y Apellido
                  <input className="input" value={draft.nombre} onChange={(e) => updateField('nombre', e.target.value)} />
                </label>

                <label className="preocupacional__label">
                  DNI
                  <input className="input" value={draft.dni} onChange={(e) => updateField('dni', e.target.value)} />
                </label>
              </div>

              <div className="preocupacional__row">
                <label className="preocupacional__label">
                  Puesto a ocupar
                  <input className="input" value={draft.puesto} onChange={(e) => updateField('puesto', e.target.value)} />
                </label>
              </div>

              <div className="preocupacional__checks">
                <CheckBox label="Examen Preocupacional" checked={draft.checks.preocupacional} onClick={() => toggleCheck('preocupacional')} />
                <CheckBox label="Examen Periódico" checked={draft.checks.periodico} onClick={() => toggleCheck('periodico')} />
                <CheckBox label="Examen Egreso" checked={draft.checks.egreso} onClick={() => toggleCheck('egreso')} />
              </div>

              <div className="preocupacional__signs">
                <div className="preocupacional__sign">
                  <div className="preocupacional__line" />
                  <span>Firma del trabajador</span>
                </div>

                <div className="preocupacional__sign">
                  <div className="preocupacional__line" />
                  <span>Firma del médico</span>
                </div>
              </div>
            </>
          ) : view === 'adicionales' ? (
            <>
              <div className="preocupacional__ad-head">
                <div>
                  <h3 className="preocupacional__section-title">Adicionales</h3>
                  <p className="preocupacional__subtitle" style={{ marginTop: 6 }}>
                    Tildá los adicionales y luego presioná <b>Guardar</b> para enviarlos a la rendición mensual.
                  </p>
                </div>

                <div className="preocupacional__ad-actions">
                  <button className="btn btn--outline" type="button" onClick={() => setAdQ('')}>
                    Limpiar búsqueda
                  </button>
                  <button className="btn btn--outline" type="button" onClick={clearAdicionalesSelection}>
                    Limpiar selección
                  </button>
                  <button className="btn btn--primary" type="button" onClick={saveAdicionales}>
                    Guardar
                  </button>
                </div>
              </div>

              <div className="preocupacional__ad-search">
                <input className="input" placeholder="Buscar adicional…" value={adQ} onChange={(e) => setAdQ(e.target.value)} />
                <div className="preocupacional__ad-count">
                  Seleccionados: <b>{draft.adicionalesSelected.length}</b>
                </div>
              </div>

              <div className="adicionales-grid">
                {filteredAdicionales.map((name) => {
                  const checked = draft.adicionalesSelected.includes(name)
                  return (
                    <label key={name} className="adicional-item">
                      <input type="checkbox" checked={checked} onChange={() => toggleAdicional(name)} />
                      <span>{name}</span>
                    </label>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="preocupacional__ad-actions" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                <button className="btn btn--outline" type="button" onClick={clearClasificacionSelection}>
                  Limpiar selección
                </button>
              </div>

              <div className="preocupacional__clasif">
                <h3 className="preocupacional__section-title">Clasificación</h3>

                <div className="clasif-grid" role="radiogroup" aria-label="Clasificación A a E">
                  {(['A', 'B', 'C', 'D', 'E'] as ClasifKey[]).map((k) => {
                    const sub = k === 'D' ? 'CON LIMITACION' : k === 'E' ? 'NO APTO' : 'SIN INCAPACIDAD'
                    return (
                      <button
                        key={k}
                        type="button"
                        className={'clasif-item' + (draft.clasificacion === k ? ' clasif-item--active' : '')}
                        onClick={() => setDraft((p) => ({ ...p, clasificacion: k }))}
                      >
                        <div className="clasif-item__top">
                          <span className="clasif-item__letter">{k}</span>
                          <span className="clasif-item__mark">( {draft.clasificacion === k ? 'X' : '-'} )</span>
                        </div>
                        <div className="clasif-item__sub">{sub}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="preocupacional__obs">
                <div className="preocupacional__obs-head">
                  <h3 className="preocupacional__section-title">Observaciones</h3>
                  <button className="btn btn--outline btn--sm" type="button" onClick={addObs}>
                    + Agregar
                  </button>
                </div>

                <div className="obs-list">
                  {draft.observaciones.map((line, i) => (
                    <div key={i} className="obs-row">
                      <span className="obs-bullet">•</span>
                      <input
                        className="input"
                        value={line}
                        placeholder="Escribí una observación…"
                        onChange={(e) => setObs(i, e.target.value)}
                      />
                      <button className="btn btn--ghost btn--sm" type="button" onClick={() => removeObs(i)} aria-label="Quitar">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="preocupacional__legend">
                  <p className="preocupacional__legend-text">
                    Por la presente me notifico de mis afecciones detectadas en el presente examen en un total acuerdo al art. 6 inc. 3 de la Ley
                    24557 de Accidentes de Trabajo.
                  </p>

                  <div
                    className="preocupacional__legend-check"
                    role="button"
                    tabIndex={0}
                    onClick={() => setDraft((p) => ({ ...p, notificado: !p.notificado }))}
                  >
                    <span className="legend-box">{draft.notificado ? 'X' : ''}</span>
                    <span>Notificado / Conforme</span>
                  </div>
                </div>

                <div className="preocupacional__signs">
                  <div className="preocupacional__sign">
                    <div className="preocupacional__line" />
                    <span>Firma del trabajador</span>
                  </div>

                  <div className="preocupacional__sign">
                    <div className="preocupacional__line" />
                    <span>Firma del médico</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="preocupacional__footer">
          <button className="btn btn--outline" type="button" onClick={togglePreview}>
            {previewOpen ? 'Cerrar previsualización' : 'Previsualizar'}
          </button>
          <button className="btn btn--primary" type="button" onClick={handleDownload}>
            Descargar PDF
          </button>
        </div>
      </div>

      {previewOpen && (
        <div className="preocupacional-preview-wrap">
          <div className="card preocupacional__preview">
            <div className="preocupacional__preview-head">
              <span className="preocupacional__preview-title">Previsualización</span>
              <button className="btn btn--ghost btn--sm" type="button" onClick={closePreview}>
                Ocultar
              </button>
            </div>

            <div className="preocupacional__preview-frame">
              {previewUrl ? <iframe title="preview" src={previewUrl} /> : <div className="preocupacional__preview-loading">Generando vista previa…</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CheckBox({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <div className="preocupacional-check" onClick={onClick} role="button" tabIndex={0}>
      <div className="preocupacional-check__box">{checked && <span className="preocupacional-check__x">✕</span>}</div>
      <span className="preocupacional-check__label">{label}</span>
    </div>
  )
}
