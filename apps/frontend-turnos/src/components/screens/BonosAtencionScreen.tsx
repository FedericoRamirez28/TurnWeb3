// apps/frontend-turnos/src/components/screens/BonosAtencionScreen.tsx

import React, { useMemo, useState } from 'react'
import type { Affiliate, Appointment } from '@/components/screens/homeModels'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'

// ✅ IMPORTAR LOGO COMO ASSET (Vite)
import logoMedic from '@/assets/logoMedic.png'

type Props = {
  affiliates: Affiliate[]
  appointments?: Appointment[] // opcional (no se usa por ahora)
}

type AffiliateWithBirth = Affiliate & { fechaNacimiento?: string | null }

// ===== Prestadores (helper local) =====
type PrestadorListItem = { id: string; nombre: string }
const PRESTADORES: PrestadorListItem[] = [
  { id: 'vitas', nombre: 'VITAS' },
  { id: 'cepem', nombre: 'CEPEM' },
  { id: 'doctores-molinas', nombre: 'DOCTORES MOLINAS' },
  { id: 'sigma', nombre: 'SIGMA' },
  { id: 'tesla', nombre: 'TESLA' },
  { id: 'tc-haedo', nombre: 'TC HAEDO' },
  { id: 'medic', nombre: 'MEDIC' },
]

// ===== Helpers =====
function safeStr(v: unknown): string {
  return String(v ?? '').trim()
}

// Hoy en Buenos Aires (UTC-3) en formato YYYY-MM-DD (ideal para <input type="date">)
function getTodayBuenosAiresISO(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${y}-${m}-${d}`
}

// ✅ Para el PDF: formatear YYYY-MM-DD -> DD-MM-YYYY (formato Argentina)
function formatDateAR(iso: string): string {
  const s = safeStr(iso)
  if (!s) return ''
  const [y, m, d] = s.split('-')
  if (!y || !m || !d) return s
  return `${d}-${m}-${y}`
}

function calcAgeFromISO(iso?: string | null): number | null {
  const s = safeStr(iso)
  if (!s) return null
  const datePart = s.length >= 10 ? s.slice(0, 10) : s
  const d = new Date(datePart)
  if (Number.isNaN(d.getTime())) return null

  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 && age <= 120 ? age : null
}

function setDashed(doc: jsPDF, dash: number[] = [1.0, 1.2]) {
  ;(doc as unknown as { setLineDashPattern?: (dashArray: number[], dashPhase: number) => void })
    .setLineDashPattern?.(dash, 0)
}
function clearDash(doc: jsPDF) {
  ;(doc as unknown as { setLineDashPattern?: (dashArray: number[], dashPhase: number) => void })
    .setLineDashPattern?.([], 0)
}

function loadImageAsDataURL(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No se pudo crear canvas 2d'))
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error(`No se pudo cargar imagen: ${src}`))
    img.src = src
  })
}

async function generateBonoPdf(params: {
  obraSocial: string
  benefPlan: string
  nombre: string
  documento: string
  edad: string
  fechaAtencionISO: string // "YYYY-MM-DD"
  especialidad: string
  diagnostico: string
  prestador: string
}) {
  // ✅ Talón apaisado con alto para firmas
  const W = 170
  const H = 130

  const doc = new jsPDF({
    unit: 'mm',
    format: [W, H],
    orientation: 'landscape',
  })

  doc.setTextColor(20, 20, 20)
  doc.setLineWidth(0.35)

  // Marco
  doc.rect(4, 4, W - 8, H - 8)

  // Logo (más chico y prolijo)
  try {
    const logoData = await loadImageAsDataURL(logoMedic)
    const logoW = 36
    const logoH = 36
    doc.addImage(logoData, 'PNG', W - 10 - logoW, 1, logoW, logoH)
  } catch {
    // si falla, seguimos sin logo
  }

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('BONO DE ATENCIÓN MÉDICA', 8, 14)

  // Prestador
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`Prestador: ${params.prestador || '-'}`, 8, 24)

  // Layout filas
  const leftX = 8
  const labelW = 48
  const lineX1 = leftX + labelW
  const lineX2 = W - 10

  let y = 33
  const rowGap = 6.9

  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text(label, leftX, y)

    setDashed(doc, [0.8, 1.1])
    doc.line(lineX1, y + 0.8, lineX2, y + 0.8)
    clearDash(doc)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    const v = safeStr(value)
    if (v) doc.text(v, lineX1 + 1, y)

    y += rowGap
  }

  row('OBRA SOCIAL:', params.obraSocial)
  row('N° DE BENEF/PLAN:', params.benefPlan)
  row('NOM. Y APELL.:', params.nombre)
  row('DOCUMENTO:', params.documento)
  row('EDAD:', params.edad)

  // ✅ ACÁ: el PDF lo quiere en DD-MM-YYYY
  row('FECHA DE ATENC.:', formatDateAR(params.fechaAtencionISO))

  row('ESPECIALIDAD:', params.especialidad)
  row('DIAGNÓSTICO:', params.diagnostico)

  // ===== Firmas =====
  y += 3
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.3)

  const firmaRow = (label: string) => {
    doc.text(label, leftX, y)
    setDashed(doc, [0.8, 1.1])
    doc.line(leftX, y + 5.0, lineX2, y + 5.0)
    clearDash(doc)
    y += 11.2
  }

  firmaRow('FIRMA DEL PROFESIONAL Y SELLO')
  firmaRow('FIRMA Y ACLARACIÓN DEL PACIENTE')
  firmaRow('DOC. DEL FIRMANTE')

  return doc
}

export default function BonosAtencionScreen({ affiliates }: Props) {
  const [afiliadoId, setAfiliadoId] = useState('')
  const [prestadorId, setPrestadorId] = useState('')

  // Turno (opcional) como fecha calendario (YYYY-MM-DD)
  const [turnoFechaISO, setTurnoFechaISO] = useState('')

  // Fecha sugerida BA UTC-3 como calendario (YYYY-MM-DD)
  const [fechaISO, setFechaISO] = useState(getTodayBuenosAiresISO())

  // Inputs libres
  const [obraSocial, setObraSocial] = useState('MEDIC')
  const [edad, setEdad] = useState('')
  const [practica, setPractica] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const selectedAffiliate = useMemo(
    () => affiliates.find((a) => a.id === afiliadoId) ?? null,
    [affiliates, afiliadoId],
  )

  const prestadorNombre = useMemo(
    () => PRESTADORES.find((p) => p.id === prestadorId)?.nombre ?? '',
    [prestadorId],
  )

  const edadSugerida = useMemo(() => {
    if (!selectedAffiliate) return ''
    const a = selectedAffiliate as AffiliateWithBirth
    const computed = calcAgeFromISO(a.fechaNacimiento ?? null)
    return computed != null ? String(computed) : ''
  }, [selectedAffiliate])

  const handleEmitir = async () => {
    if (!selectedAffiliate) return void Swal.fire('Error', 'Elegí un afiliado', 'error')
    if (!prestadorId) return void Swal.fire('Error', 'Elegí un prestador', 'error')
    if (!safeStr(practica)) return void Swal.fire('Error', 'Completá la especialidad/práctica', 'error')
    if (!safeStr(obraSocial)) return void Swal.fire('Error', 'Completá Obra social', 'error')

    // ✅ fecha ISO para guardar/filename (YYYY-MM-DD)
    const fechaAtencionISO = safeStr(turnoFechaISO) || safeStr(fechaISO)
    if (!fechaAtencionISO) return void Swal.fire('Error', 'Completá la fecha', 'error')

    const edadFinal = safeStr(edad) || safeStr(edadSugerida) || ''

    const benefPlan = `${safeStr(selectedAffiliate.numeroAfiliado)}${
      selectedAffiliate.plan ? ` / ${safeStr(selectedAffiliate.plan)}` : ''
    }`

    try {
      const pdf = await generateBonoPdf({
        obraSocial: safeStr(obraSocial),
        benefPlan,
        nombre: safeStr(selectedAffiliate.nombreCompleto),
        documento: safeStr(selectedAffiliate.dni),
        edad: edadFinal,
        fechaAtencionISO,
        especialidad: safeStr(practica),
        diagnostico: safeStr(observaciones),
        prestador: prestadorNombre || '-',
      })

      // filename: mantenemos ISO (más ordenado)
      pdf.save(`Bono-${safeStr(selectedAffiliate.dni) || 'sin-dni'}-${fechaAtencionISO}.pdf`)
    } catch (e) {
      console.error(e)
      void Swal.fire('Error', 'No se pudo generar el PDF.', 'error')
    }
  }

  return (
    <section className="bonos-screen card card--stretch">
      <header className="card__header">
        <div>
          <h2 className="card__title">Bono de Atención</h2>
          <p className="card__subtitle">Generá un bono imprimible (formato talón apaisado).</p>
        </div>

        <button className="btn btn--primary" type="button" onClick={() => void handleEmitir()}>
          Emitir PDF
        </button>
      </header>

      <div className="bonos-grid">
        <label className="field">
          <span className="field__label">Afiliado</span>
          <select className="input" value={afiliadoId} onChange={(e) => setAfiliadoId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {affiliates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombreCompleto} · DNI {a.dni} · Nº {a.numeroAfiliado}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Prestador</span>
          <select className="input" value={prestadorId} onChange={(e) => setPrestadorId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {PRESTADORES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Turno (opcional)</span>
          <input
            type="date"
            className="input"
            value={turnoFechaISO}
            onChange={(e) => setTurnoFechaISO(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Fecha sugerida</span>
          <input
            type="date"
            className="input"
            value={fechaISO}
            onChange={(e) => setFechaISO(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Obra social</span>
          <input
            className="input"
            value={obraSocial}
            onChange={(e) => setObraSocial(e.target.value)}
            placeholder="Ej: MEDIC / OSDE / Swiss Medical…"
          />
        </label>

        <label className="field">
          <span className="field__label">Edad</span>
          <input
            className="input"
            value={edad}
            onChange={(e) => setEdad(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
            placeholder={edadSugerida ? `Sugerida: ${edadSugerida}` : 'Ej: 35'}
            inputMode="numeric"
          />
        </label>

        <label className="field">
          <span className="field__label">Especialidad / Práctica</span>
          <input
            className="input"
            value={practica}
            onChange={(e) => setPractica(e.target.value)}
            placeholder="Ej: Cardiología / ECG / Laboratorio…"
          />
        </label>

        <label className="field field--full">
          <span className="field__label">Diagnóstico / Observaciones</span>
          <textarea
            className="input"
            rows={5}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Notas / diagnóstico / indicaciones…"
          />
        </label>
      </div>
    </section>
  )
}
