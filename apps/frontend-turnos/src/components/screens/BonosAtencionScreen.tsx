// apps/frontend-turnos/src/components/screens/BonosAtencionScreen.tsx

import React, { useMemo, useState } from 'react'
import type { Affiliate, Appointment } from '@/components/screens/homeModels'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'

// ✅ IMPORTAR LOGO COMO ASSET (Vite)
import logoMedic from '@/assets/logoMedic.png'

type Props = {
  affiliates: Affiliate[]
  appointments?: Appointment[] // opcional
}

type AffiliateWithBirth = Affiliate & { fechaNacimiento?: string | null }

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

function safeStr(v: unknown): string {
  return String(v ?? '').trim()
}

// Hoy en Buenos Aires (UTC-3) en formato YYYY-MM-DD para <input type="date">
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

// ✅ para mostrar en el PDF: DD-MM-YYYY
function formatDateDDMMYYYY(isoDate: string): string {
  const s = safeStr(isoDate)
  if (!s) return ''
  const [yy, mm, dd] = s.split('-')
  if (!yy || !mm || !dd) return s
  return `${dd}-${mm}-${yy}`
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
  ;(doc as unknown as { setLineDashPattern?: (dashArray: number[], dashPhase: number) => void }).setLineDashPattern?.(
    dash,
    0,
  )
}
function clearDash(doc: jsPDF) {
  ;(doc as unknown as { setLineDashPattern?: (dashArray: number[], dashPhase: number) => void }).setLineDashPattern?.(
    [],
    0,
  )
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

/**
 * ✅ Watermark tile con LOGO ROTADO (diagonal “real”)
 * - angleDeg: ángulo del logo dentro del tile
 * - opacity: 0..1
 * - lighten: mezcla con blanco (0..1)
 */
function makeWatermarkTileRotated(
  logoSrc: string,
  opts?: { basePx?: number; opacity?: number; lighten?: number; angleDeg?: number; scale?: number },
) {
  const basePx = opts?.basePx ?? 520
  const opacity = opts?.opacity ?? 0.11
  const lighten = opts?.lighten ?? 0.62
  const angleDeg = opts?.angleDeg ?? -25
  const scale = opts?.scale ?? 0.78

  return new Promise<string>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = basePx
      canvas.height = basePx
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No canvas ctx'))

      ctx.clearRect(0, 0, basePx, basePx)

      // centro
      const cx = basePx / 2
      const cy = basePx / 2

      // tamaño del logo dentro del tile
      const maxW = basePx * scale
      const maxH = basePx * 0.26
      const ratio = Math.min(maxW / img.width, maxH / img.height)
      const w = img.width * ratio
      const h = img.height * ratio

      // dibujar rotado
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((angleDeg * Math.PI) / 180)
      ctx.translate(-w / 2, -h / 2)
      ctx.drawImage(img, 0, 0, w, h)
      ctx.restore()

      // lavar con blanco (apagar colores)
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = `rgba(255,255,255,${lighten})`
      ctx.fillRect(0, 0, basePx, basePx)

      // opacidad final
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = opacity

      // “horneamos” a PNG
      const out = canvas.toDataURL('image/png')
      resolve(out)
    }
    img.onerror = () => reject(new Error(`No se pudo cargar imagen: ${logoSrc}`))
    img.src = logoSrc
  })
}

async function generateBonoPdf(params: {
  obraSocial: string
  benefPlan: string
  nombre: string
  documento: string
  edad: string
  fechaAtencionISO: string // YYYY-MM-DD
  especialidad: string
  diagnostico: string
  prestador: string
}) {
  const W = 170
  const H = 130

  const doc = new jsPDF({
    unit: 'mm',
    format: [W, H],
    orientation: 'landscape',
  })

  // ===== Background watermark (logo repetido diagonal) =====
  try {
    // ✅ más “diagonal” y más repetición
    const tile = await makeWatermarkTileRotated(logoMedic, {
      basePx: 520,
      opacity: 0.10, // subí/bajá si querés
      lighten: 0.62,
      angleDeg: -25,
      scale: 0.82,
    })

    // tamaño del tile en mm (más chico = más logos)
    const tileMmW = 30
    const tileMmH = 30

    for (let y = -tileMmH * 20; y < H + tileMmH * 20; y += tileMmH) {
      for (let x = -tileMmW * 20; x < W + tileMmW * 20; x += tileMmW) {
        // offset tipo “damero” para que se vea más diagonal/fluido
        const xOff = ((Math.floor(y / tileMmH) % 2) * tileMmW) / 2
        doc.addImage(tile, 'PNG', x + xOff, y, tileMmW, tileMmH, undefined, 'FAST')
      }
    }
  } catch {
    // si falla watermark, seguimos sin
  }

  // ===== Estilo base =====
  doc.setTextColor(20, 20, 20)
  doc.setLineWidth(0.35)

  // Marco
  doc.rect(4, 4, W - 8, H - 8)

  // Logo header (chico, prolijo)
  try {
    const logoData = await loadImageAsDataURL(logoMedic)
    const logoW = 36
    const logoH = 36
    doc.addImage(logoData, 'PNG', W - 10 - logoW, -2, logoW, logoH, undefined, 'FAST')
  } catch {
    // sin logo
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

  // ✅ filas base
  row('OBRA SOCIAL:', params.obraSocial)
  row('N° DE BENEF/PLAN:', params.benefPlan)
  row('NOM. Y APELL.:', params.nombre)
  row('DOCUMENTO:', params.documento)
  row('EDAD:', params.edad)
  row('FECHA DE ATENC.:', formatDateDDMMYYYY(params.fechaAtencionISO))
  row('ESPECIALIDAD:', params.especialidad)
  row('DIAGNÓSTICO:', params.diagnostico)

  // ✅ filas extra (líneas para escribir más) debajo de diagnóstico
  const EXTRA_LINES = 0 // <-- subí a 4/5 si querés
  for (let i = 0; i < EXTRA_LINES; i++) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text('', leftX, y)

    setDashed(doc, [0.8, 1.1])
    doc.line(lineX1, y + 0.8, lineX2, y + 0.8)
    clearDash(doc)

    y += rowGap
  }

  // Firmas
  y += 2
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

  const [turnoFechaISO, setTurnoFechaISO] = useState(getTodayBuenosAiresISO())
  const [fechaISO, setFechaISO] = useState(getTodayBuenosAiresISO())

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
          <p className="card__subtitle">Generá un bono imprimible (formato talón apaisado) con fondo de seguridad.</p>
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
          <input type="date" className="input" value={turnoFechaISO} onChange={(e) => setTurnoFechaISO(e.target.value)} />
        </label>

        <label className="field">
          <span className="field__label">Fecha sugerida</span>
          <input type="date" className="input" value={fechaISO} onChange={(e) => setFechaISO(e.target.value)} />
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
