// src/components/screens/PreocupacionalScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  // ✅ ahora es texto libre (copiar/pegar desde Word)
  observaciones: string

  adicionalesSelected: string[]
}

type PreocupacionalPrefill = {
  empresa?: string
  nroAfiliado?: string
  nombre?: string
  dni?: string
  puesto?: string
  examen?: string // puede venir "A + B + C"
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

const STORAGE_KEY_DRAFT = 'medic_laboral_preocupacional_draft_v4'
const STORAGE_KEY_PREFILL = 'medic_laboral_preocupacional_prefill_v1'

function getApiBase(): string {
  const env = import.meta.env as Record<string, string | undefined>
  const base = env.VITE_API_BASE_URL
  if (!base) throw new Error('Falta VITE_API_BASE_URL en .env')
  return base.replace(/\/$/, '')
}

function blankDraft(): Draft {
  return {
    empresa: '',
    nroAfiliado: '',
    nombre: '',
    dni: '',
    puesto: '',
    checks: { preocupacional: false, periodico: false, egreso: false },

    clasificacion: 'C',
    observaciones: '',

    adicionalesSelected: [],
  }
}

function loadDraft(): Draft {
  const fallback = blankDraft()

  try {
    const raw = localStorage.getItem(STORAGE_KEY_DRAFT)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<Draft> & { observaciones?: unknown }

    const obsRaw = parsed.observaciones

    return {
      ...fallback,
      ...parsed,
      checks: { ...fallback.checks, ...(parsed.checks || {}) },
      // ✅ migra formato viejo string[] -> string (líneas)
      observaciones: Array.isArray(obsRaw)
        ? obsRaw.filter((x): x is string => typeof x === 'string').join('\n')
        : typeof obsRaw === 'string'
          ? obsRaw
          : fallback.observaciones,
      clasificacion: (parsed.clasificacion as ClasifKey) || fallback.clasificacion,
      adicionalesSelected: Array.isArray(parsed.adicionalesSelected) ? parsed.adicionalesSelected : [],
    }
  } catch {
    return fallback
  }
}

// ✅ dd/mm/yyyy siempre con 0 adelante
function fmtDate(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  return `${dd}/${mm}/${yyyy}`
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

/** Normalización fuerte para comparar ítems aunque cambie puntuación / slashes / puntos */
function normalizeKey(s: string) {
  return normalizeText(s).replace(/[^a-z0-9]+/g, ' ').trim()
}

function uniqByNorm(items: string[]) {
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

function canonicalizeAdicional(raw: string, options: string[]) {
  const v = (raw || '').trim()
  if (!v) return ''
  const key = normalizeKey(v)
  if (!key) return v

  const map = new Map<string, string>()
  for (const o of options) map.set(normalizeKey(o), o)

  const exact = map.get(key)
  if (exact) return exact

  // fallback: contains (por si algún separador raro cambió)
  let best: { opt: string; score: number } | null = null
  for (const o of options) {
    const ok = normalizeKey(o)
    if (!ok) continue

    const match = ok.includes(key) || key.includes(ok)
    if (!match) continue

    const score = Math.min(ok.length, key.length)
    if (!best || score > best.score) best = { opt: o, score }
  }
  return best ? best.opt : v
}

function parseTipoExamenToAdicionales(tipoExamenRaw: string, options: string[]) {
  const raw = (tipoExamenRaw || '').trim()
  if (!raw) return []

  // viene "A + B + C"
  const parts = raw
    .split(/\s*\+\s*/g)
    .map((x) => x.trim())
    .filter(Boolean)

  const canon = parts.map((p) => canonicalizeAdicional(p, options)).filter(Boolean)
  return uniqByNorm(canon)
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

const ADICIONALES_ALL = [...ADICIONALES_CONCEPTO, ...ADICIONALES_LAB]

// ===================== PDF: layout fijo para encastre =====================
// A4 (mm). Vamos a usar SIEMPRE las mismas coordenadas
const PDF = {
  margin: 16,
  // Bloque planilla
  y0: 52,
  // donde empiezan los 3 checks (tiene que ser idéntico en completo/planilla)
  checksY: 52 + 44, // 96
  // El “cuadrado azul” (bloque intermedio) empieza acá
  clasifTop: 52 + 44 + 18, // 114
}

// ====== helpers pdf ======

function drawCheckbox(doc: jsPDF, x: number, y: number, label: string, checked: boolean) {
  doc.rect(x, y, 6, 6)
  if (checked) {
    doc.setFont('helvetica', 'bold')
    doc.text('X', x + 1.6, y + 5)
    doc.setFont('helvetica', 'normal')
  }
  doc.text(label, x + 9, y + 5)
}

// ✅ Header: SOLO fecha (quitamos “EXAMEN MEDICO” tachado)
function drawHeader(doc: jsPDF, opts: { dateText: string }) {
  const pageW = doc.internal.pageSize.getWidth()
  const margin = PDF.margin

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(opts.dateText, pageW - margin, 18, { align: 'right' })
}

function drawFirmas(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = PDF.margin

  const signatureY = pageH - 22
  doc.setDrawColor(15, 23, 42)
  doc.line(margin, signatureY, margin + 80, signatureY)
  doc.line(pageW - margin - 80, signatureY, pageW - margin, signatureY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text('FIRMA DEL TRABAJADOR', margin + 40, signatureY + 7, { align: 'center' })
  doc.text('FIRMA DEL MEDICO', pageW - margin - 40, signatureY + 7, { align: 'center' })
}

/**
 * Bloque "Clasificación / Observaciones"
 * - includePicker = true  => dibuja A/B/C/D/E + Observaciones + Leyenda
 * - includePicker = false => NO dibuja A/B/C/D/E; solo Observaciones + Leyenda
 */
function drawClasificacionBlock(
  doc: jsPDF,
  draft: Draft,
  yTop: number,
  opts: { includeTitle: boolean; includePicker: boolean },
) {
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = PDF.margin
  const maxW = pageW - margin * 2

  const yClasifTop = yTop

  if (opts.includeTitle) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    // si no hay picker, el título queda más fiel a lo que se muestra
    doc.text(opts.includePicker ? 'CLASIFICACION' : 'OBSERVACIONES', margin, yClasifTop)
  }

  const yBase = yClasifTop + (opts.includeTitle ? 12 : 0)

  let obsTitleY = yBase

  if (opts.includePicker) {
    const items: { k: ClasifKey; title: string; sub: string }[] = [
      { k: 'A', title: 'A', sub: 'SIN INCAPACIDAD' },
      { k: 'B', title: 'B', sub: 'SIN INCAPACIDAD' },
      { k: 'C', title: 'C', sub: 'SIN INCAPACIDAD' },
      { k: 'D', title: 'D', sub: 'CON LIMITACION' },
      { k: 'E', title: 'E', sub: 'NO APTO' },
    ]

    const gap = 6
    const boxW = (pageW - margin * 2 - gap * 4) / 5
    let x = margin

    items.forEach((it, idx) => {
      doc.setDrawColor(148, 163, 184)
      doc.rect(x, yBase, boxW, 22)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text(it.title, x + 4, yBase + 7)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.8)
      doc.setTextColor(100, 116, 139)
      doc.text(it.sub, x + boxW / 2, yBase + 18, { align: 'center' })

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      const mark = draft.clasificacion === it.k ? 'X' : '-'
      doc.text(`( ${mark} )`, x + boxW - 14, yBase + 7)

      x += boxW + (idx < 4 ? gap : 0)
    })

    obsTitleY = yBase + 34
  } else {
    // sin picker, arrancamos observaciones más arriba
    obsTitleY = yBase + 6
  }

  // Si ya pusimos título OBSERVACIONES arriba, evitamos repetir "Observaciones:" abajo
  const showObsLabel = opts.includePicker

  if (showObsLabel) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(15, 23, 42)
    doc.text('Observaciones:', margin, obsTitleY)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)

  const obsStartY = showObsLabel ? obsTitleY + 10 : obsTitleY + 6

  // ✅ texto libre (respetamos saltos de línea, sin bullets automáticos)
  const obsText = (draft.observaciones || '').replace(/\r\n/g, '\n').trim()

  // Importante: este bloque debe entrar ANTES de las firmas de la planilla
  const signatureY = pageH - 22
  const legendMaxBottom = signatureY - 10
  const maxObsBottom = legendMaxBottom - 28

  let oy = obsStartY

  if (!obsText) {
    doc.setTextColor(100, 116, 139)
    doc.text('-', margin, oy)
    doc.setTextColor(15, 23, 42)
    oy += 6
  } else {
    const rawLines = obsText.split('\n').map((x) => x.trimEnd())
    const lines: string[] = []
    for (const ln of rawLines) {
      if (!ln.trim()) {
        lines.push('') // línea en blanco
        continue
      }
      const wrapped = doc.splitTextToSize(ln, maxW) as string[]
      lines.push(...wrapped)
    }

    for (const ln of lines) {
      const needed = 5 + 1
      if (oy + needed > maxObsBottom) {
        doc.setTextColor(100, 116, 139)
        doc.text('…', margin, oy)
        doc.setTextColor(15, 23, 42)
        oy += 6
        break
      }

      if (!ln) {
        oy += 4 // salto visual
        continue
      }

      doc.text(ln, margin, oy)
      oy += 5.2
    }
  }

  const legend =
    'Por la presente me notifico de mis afecciones detectadas en el presente examen en un total acuerdo al art. 6 inc. 3 de la Ley 24557 de Accidentes de Trabajo.'
  const legendLines = doc.splitTextToSize(legend, maxW)

  const legendY = Math.min(
    Math.max(oy + 6, legendMaxBottom - legendLines.length * 5 - 10),
    legendMaxBottom - legendLines.length * 5 - 10,
  )

  doc.setFontSize(9.6)
  doc.setTextColor(15, 23, 42)
  doc.text(legendLines, margin, legendY)
}

// ===================== PDF COMPLETO =====================
function buildPdfCompleto(draft: Draft, dateText: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = PDF.margin

  drawHeader(doc, { dateText })

  const y0 = PDF.y0
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)

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

  const cy = PDF.checksY
  drawCheckbox(doc, margin, cy, 'Examen Preocupacional', draft.checks.preocupacional)
  drawCheckbox(doc, margin + 70, cy, 'Examen Periodico', draft.checks.periodico)
  drawCheckbox(doc, margin + 132, cy, 'Examen Egreso', draft.checks.egreso)

  // ✅ En Periódico/Egreso NO hay selector A-E, pero sí Observaciones + Leyenda
  const includePicker = !(draft.checks.periodico || draft.checks.egreso)
  drawClasificacionBlock(doc, draft, PDF.clasifTop, { includeTitle: true, includePicker })

  drawFirmas(doc)
  return doc
}

// ===================== PDF VISTA (tab actual) =====================
function buildPdfVista(view: ViewKey, draft: Draft, dateText: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = PDF.margin
  const maxW = pageW - margin * 2

  // ✅ En vista “clasificacion” NO dibujamos fecha/header (pedido)
  if (view !== 'clasificacion') drawHeader(doc, { dateText })

  if (view === 'planilla') {
    const y0 = PDF.y0

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)

    doc.text('EMPRESA:', margin, y0)
    doc.text(draft.empresa || ' ', margin + 40 , y0)

    doc.text('N° AFILIADO:', pageW / 2 + 20, y0)
    doc.text(draft.nroAfiliado || ' ', pageW / 2 + 46, y0)

    doc.text('NOMBRE Y APELLIDO:', margin, y0 + 12)
    doc.text(draft.nombre || ' ', margin + 40, y0 + 12)

    doc.text('DNI:', pageW / 2 + 20, y0 + 12)
    doc.text(draft.dni || ' ', pageW / 2 + 46, y0 + 12)

    doc.text('PUESTO A OCUPAR:', margin, y0 + 24)
    doc.text(draft.puesto || ' ', margin + 40, y0 + 24)

    const cy = PDF.checksY
    drawCheckbox(doc, margin, cy, 'Examen Preocupacional', draft.checks.preocupacional)
    drawCheckbox(doc, margin + 70, cy, 'Examen Periodico', draft.checks.periodico)
    drawCheckbox(doc, margin + 132, cy, 'Examen Egreso', draft.checks.egreso)

    drawFirmas(doc)
    return doc
  }

  if (view === 'adicionales') {
    const y0 = PDF.y0

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)

    doc.text('EMPRESA:', margin, y0)
    doc.text(draft.empresa || ' ', margin + 26, y0)

    doc.text('NOMBRE:', margin, y0 + 12)
    doc.text(draft.nombre || ' ', margin + 26, y0 + 12)

    doc.text('DNI:', pageW / 2 + 20, y0 + 12)
    doc.text(draft.dni || ' ', pageW / 2 + 30, y0 + 12)

    doc.text('N° AFILIADO:', margin, y0 + 24)
    doc.text(draft.nroAfiliado || ' ', margin + 30, y0 + 24)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Seleccionados:', margin, y0 + 40)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    const items = (draft.adicionalesSelected || []).slice().sort((a, b) => a.localeCompare(b))
    let y = y0 + 50

    if (!items.length) {
      doc.setTextColor(100, 116, 139)
      doc.text('-', margin, y)
      doc.setTextColor(15, 23, 42)
      y += 8
    } else {
      for (const it of items) {
        const wrapped = doc.splitTextToSize(`• ${it}`, maxW)
        const needed = wrapped.length * 5 + 1

        if (y + needed > pageH - 34) {
          doc.addPage()
          drawHeader(doc, { dateText })
          y = PDF.y0
        }

        doc.text(wrapped, margin, y)
        y += needed
      }
    }

    drawFirmas(doc)
    return doc
  }

  // ✅ view === 'clasificacion'
  {
    const includePicker = !(draft.checks.periodico || draft.checks.egreso)
    drawClasificacionBlock(doc, draft, PDF.clasifTop, { includeTitle: true, includePicker })
    return doc
  }
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

  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [view, setView] = useState<ViewKey>('planilla')

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const [adQ, setAdQ] = useState('')

  const today = useMemo(() => fmtDate(new Date()), [])
  const todayISO = useMemo(() => isoDay(new Date()), [])

  // ✅ mostrar selector A-E solo si NO es Periódico/Egreso
  const showClasifPicker = useMemo(
    () => !(draft.checks.periodico || draft.checks.egreso),
    [draft.checks.periodico, draft.checks.egreso],
  )

  const currentDocCompleto = useCallback(async () => buildPdfCompleto(draft, today), [draft, today])
  const currentDocVista = useCallback(async () => buildPdfVista(view, draft, today), [view, draft, today])

  const setPdfPreview = useCallback(async (docPromise: Promise<jsPDF>) => {
    const doc = await docPromise
    try {
      const blob: Blob = doc.output('blob')
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
    void setPdfPreview(currentDocVista())
  }, [currentDocVista, setPdfPreview])

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

  const handleDownloadCompleto = useCallback(async () => {
    try {
      const doc = await currentDocCompleto()
      const safeName =
        (draft.nombre || 'examen')
          .trim()
          .replace(/\s+/g, '_')
          .replace(/[^\w-]/g, '')
          .slice(0, 40) || 'examen'

      doc.save(`Completo_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'No se pudo descargar', text: msg })
    }
  }, [currentDocCompleto, draft.nombre])

  const handleDownloadVista = useCallback(async () => {
    try {
      const doc = await currentDocVista()
      const safeName =
        (draft.nombre || 'examen')
          .trim()
          .replace(/\s+/g, '_')
          .replace(/[^\w-]/g, '')
          .slice(0, 40) || 'examen'

      const tag = view === 'planilla' ? 'Planilla' : view === 'adicionales' ? 'Adicionales' : 'Clasificacion'
      doc.save(`${tag}_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'No se pudo descargar', text: msg })
    }
  }, [currentDocVista, draft.nombre, view])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DRAFT, JSON.stringify(draft))
    } catch {
      // no-op
    }
  }, [draft])

  useEffect(() => {
    if (!previewOpen) return
    const t = window.setTimeout(() => void setPdfPreview(currentDocVista()), 200)
    return () => window.clearTimeout(t)
  }, [draft, previewOpen, view, currentDocVista, setPdfPreview])

  function toggleCheck(key: ExamKey) {
    setDraft((p) => ({ ...p, checks: { ...p.checks, [key]: !p.checks[key] } }))
  }

  function updateField<K extends keyof Omit<Draft, 'checks' | 'observaciones' | 'adicionalesSelected'>>(
    key: K,
    value: Draft[K],
  ) {
    setDraft((p) => ({ ...p, [key]: value }))
  }

  function setObsText(v: string) {
    setDraft((p) => ({ ...p, observaciones: v }))
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
      observaciones: '',
    }))
  }

  function clearAdicionalesSelection() {
    setDraft((p) => ({ ...p, adicionalesSelected: [] }))
  }

  /** ✅ Limpia TODO (planilla + adicionales + clasificación) para evitar acumular paciente anterior */
  function clearAllSelection() {
    setDraft(blankDraft())
    setAdQ('')
  }

  const prefillAppliedRef = useRef(false)
  useEffect(() => {
    prefillAppliedRef.current = false
  }, [location.key])

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
    const incomingExamRaw = (payload.examen || '').trim()

    const incomingAdicionales = parseTipoExamenToAdicionales(incomingExamRaw, ADICIONALES_ALL)

    const pick = (incoming: unknown, prev: string) => {
      if (typeof incoming !== 'string') return prev
      const v = incoming.trim()
      return v ? v : prev
    }

    const t = window.setTimeout(() => {
      const nextChecks: Record<ExamKey, boolean> = {
        preocupacional: false,
        periodico: false,
        egreso: false,
      }
      nextChecks[examKey] = true

      setDraft(() => ({
        ...blankDraft(),
        empresa: pick(payload.empresa, ''),
        nroAfiliado: pick(payload.nroAfiliado, ''),
        nombre: pick(payload.nombre, ''),
        dni: pick(payload.dni, ''),
        puesto: pick(payload.puesto, ''),
        checks: nextChecks,
        adicionalesSelected: incomingAdicionales,
      }))

      if (payload.focusTab) setView(payload.focusTab)
      else if (incomingAdicionales.length) setView('adicionales')
      else setView('planilla')

      if (incomingAdicionales.length === 1) setAdQ(incomingAdicionales[0])
      else setAdQ('')
    }, 0)

    return () => window.clearTimeout(t)
  }, [location.state, coercePrefill, safeReadPrefillFromStorage, safeClearPrefillStorage])

  const displayedAdicionales = useMemo(() => {
    const base = ADICIONALES_ALL
    const baseKeys = new Set(base.map(normalizeKey))
    const extra = (draft.adicionalesSelected || []).filter((x) => !baseKeys.has(normalizeKey(x)))
    return extra.length ? [...uniqByNorm(extra), ...base] : base
  }, [draft.adicionalesSelected])

  const filteredAdicionales = useMemo(() => {
    const qq = normalizeText(adQ)
    if (!qq) return displayedAdicionales

    const r = displayedAdicionales.filter((x) => normalizeText(x).includes(qq))
    if (!r.length) return displayedAdicionales
    return r
  }, [adQ, displayedAdicionales])

  function toggleAdicional(name: string) {
    const canonical = canonicalizeAdicional(name, ADICIONALES_ALL) || name

    setDraft((p) => {
      const has = p.adicionalesSelected.some((x) => normalizeKey(x) === normalizeKey(canonical))
      const next = has
        ? p.adicionalesSelected.filter((x) => normalizeKey(x) !== normalizeKey(canonical))
        : [...p.adicionalesSelected, canonical]
      return { ...p, adicionalesSelected: uniqByNorm(next) }
    })
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

    const selected = uniqByNorm(draft.adicionalesSelected || [])
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
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'dev-user' },
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

      clearAllSelection()
      setView('planilla')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: msg })
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

          {/* ✅ NO deshabilitamos el tab: solo se oculta el selector A-E si corresponde */}
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
              <div className="preocupacional__top-actions">
                <button className="btn btn--outline" type="button" onClick={clearPlanillaSelection}>
                  Limpiar selección
                </button>
                <button className="btn btn--primary" type="button" onClick={() => void handleDownloadCompleto()}>
                  Descargar PDF (Completo)
                </button>
              </div>

              <div className="preocupacional__row preocupacional__row--two">
                <label className="preocupacional__label">
                  Empresa
                  <input className="input" value={draft.empresa} onChange={(e) => updateField('empresa', e.target.value)} />
                </label>

                <label className="preocupacional__label">
                  Número de afiliado
                  <input className="input" value={draft.nroAfiliado} onChange={(e) => updateField('nroAfiliado', e.target.value)} />
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
                  <button className="btn btn--primary" type="button" onClick={() => void handleDownloadCompleto()}>
                    Descargar PDF (Completo)
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
                  const checked = draft.adicionalesSelected.some((x) => normalizeKey(x) === normalizeKey(name))
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
              <div className="preocupacional__top-actions">
                <button className="btn btn--outline" type="button" onClick={clearClasificacionSelection}>
                  Limpiar selección
                </button>
                <button className="btn btn--primary" type="button" onClick={() => void handleDownloadCompleto()}>
                  Descargar PDF (Completo)
                </button>
              </div>

              <div className="preocupacional__clasif">
                <h3 className="preocupacional__section-title">Clasificación</h3>

                {showClasifPicker ? (
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
                ) : (
                  <div
                    className="preocupacional__clasif-disabled"
                    style={{
                      padding: '12px 14px',
                      border: '1px dashed rgba(100,116,139,.45)',
                      borderRadius: 12,
                      background: 'rgba(148,163,184,.08)',
                      color: 'var(--color-ink-soft)',
                      marginTop: 10,
                    }}
                  >
                    Para <b>Periódico</b> y <b>Egreso</b> no corresponde seleccionar clasificación A–E. Podés completar{' '}
                    <b>Observaciones</b> igualmente.
                  </div>
                )}
              </div>

              <div className="preocupacional__obs">
                <div className="preocupacional__obs-head">
                  <h3 className="preocupacional__section-title">Observaciones</h3>
                </div>

                {/* ✅ Un solo textarea para copiar/pegar desde Word */}
                <textarea
                  className="input preocupacional__obs-textarea"
                  value={draft.observaciones}
                  placeholder="Pegá acá las observaciones (se respetan saltos de línea)…"
                  onChange={(e) => setObsText(e.target.value)}
                  rows={6}
                />

                <div className="preocupacional__legend">
                  <p className="preocupacional__legend-text">
                    Por la presente me notifico de mis afecciones detectadas en el presente examen en un total acuerdo al art. 6 inc. 3 de la Ley
                    24557 de Accidentes de Trabajo.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="preocupacional__footer">
          <button className="btn btn--outline" type="button" onClick={togglePreview}>
            {previewOpen ? 'Cerrar previsualización' : 'Previsualizar'}
          </button>

          <button className="btn btn--primary" type="button" onClick={() => void handleDownloadVista()}>
            Descargar PDF (Vista)
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
