// apps/frontend-turnos/src/components/screens/BonosAtencionScreen.tsx

import React, { useMemo, useState } from 'react'
import type { Affiliate, Appointment } from '@/components/screens/homeModels'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import { useAuth } from '@/auth/useAuth'

// ✅ IMPORTAR LOGO COMO ASSET (Vite)
import logoMedic from '@/assets/logoMedic.png'

type Props = {
  affiliates: Affiliate[]
  appointments?: Appointment[] // opcional
}

type PrestadorListItem = { id: string; nombre: string }
const PRESTADORES: PrestadorListItem[] = [
  { id: 'vitas', nombre: 'VITAS' },
  { id: 'cepem', nombre: 'CEPEM' },
  { id: 'doctores-molinas', nombre: 'DOCTORES MOLINAS' },
  { id: 'sigma', nombre: 'SIGMA' },
  { id: 'tesla', nombre: 'TESLA' },
  { id: 'tc-haedo', nombre: 'TC HAEDO' },
  { id: 'medic', nombre: 'MEDIC' },
  { id: 'Dra Uane', nombre: 'DRA UANE' },
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
 * ✅ Prepara un "watermark" único centrado, ocupando el máximo posible del PDF
 * - opacity: opacidad final (0..1)
 * - lighten: cuánto se lava con blanco (0..1) para que quede clarito
 * Devuelve DataURL PNG listo para doc.addImage(...)
 */
function makeSingleCenteredWatermark(
  logoSrc: string,
  opts?: { opacity?: number; lighten?: number },
): Promise<string> {
  const opacity = opts?.opacity ?? 0.12
  const lighten = opts?.lighten ?? 0.62

  // canvas grande para que el escalado no pixele (alto)
  const W = 1800
  const H = 1200

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('No canvas ctx'))

      ctx.clearRect(0, 0, W, H)

      // Escalamos para que el logo "entre" máximo, manteniendo proporción
      const maxW = W * 0.98
      const maxH = H * 0.98
      const ratio = Math.min(maxW / img.width, maxH / img.height)
      const w = img.width * ratio
      const h = img.height * ratio

      const x = (W - w) / 2
      const y = (H - h) / 2
      ctx.drawImage(img, x, y, w, h)

      // lavar con blanco (apagar colores)
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = `rgba(255,255,255,${lighten})`
      ctx.fillRect(0, 0, W, H)

      // opacidad final
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = opacity

      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error(`No se pudo cargar imagen: ${logoSrc}`))
    img.src = logoSrc
  })
}

/** ✅ Número de seguimiento incremental (simple, por ahora local) */
function nextSeguimiento(): string {
  try {
    const key = 'medic_bono_seguimiento'
    const n = Number(localStorage.getItem(key) ?? '0')
    const next = Number.isFinite(n) ? n + 1 : 1
    localStorage.setItem(key, String(next))
    return String(next).padStart(6, '0')
  } catch {
    return String(Date.now()).slice(-6)
  }
}

async function generateBonoPdf(params: {
  seguimiento: string
  obraSocial: string
  benefPlan: string
  nombre: string
  documento: string
  fechaAtencionISO: string // YYYY-MM-DD
  horaTurno: string // HH:mm
  especialidad: string
  diagnostico: string
  prestador: string
  autoriza: string
}) {
  const W = 170
  const H = 130

  const doc = new jsPDF({
    unit: 'mm',
    format: [W, H],
    orientation: 'landscape',
  })

  // ===== Background watermark (UNO SOLO, centrado, max width/height) =====
  try {
    const wm = await makeSingleCenteredWatermark(logoMedic, {
      opacity: 0.20, // subí/bajá
      lighten: 0.80, // subí para más clarito
    })

    // ocupa TODO el área del PDF; el PNG ya viene centrado y escalado dentro
    doc.addImage(wm, 'PNG', 0, 0, W, H, undefined, 'FAST')
  } catch {
    // sin watermark
  }

  doc.setTextColor(20, 20, 20)
  doc.setLineWidth(0.35)

  // marco
  doc.rect(4, 4, W - 8, H - 8)

  // Logo header (chico)
  try {
    const logoData = await loadImageAsDataURL(logoMedic)
    const logoW = 40
    const logoH = 40
    doc.addImage(logoData, 'PNG', W - 10 - logoW, -3, logoW, logoH, undefined, 'FAST')
  } catch {
    // sin logo
  }

  // Título
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('BONO DE ATENCIÓN MÉDICA', 8, 14)

  // Seguimiento
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`N° Seguimiento: ${params.seguimiento}`, 8, 20)

  // Prestador
  doc.setFontSize(9.5)
  doc.text(`Prestador: ${params.prestador || '-'}`, 8, 26)

  // Layout filas (SIN líneas punteadas)
  const leftX = 8
  const valueX = 58
  const rowGap = 7.0
  let y = 36

  const row = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.text(label, leftX, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.text(safeStr(value) || '-', valueX, y)

    y += rowGap
  }

  row('OBRA SOCIAL:', params.obraSocial)
  row('N° DE BENEF/PLAN:', params.benefPlan)
  row('NOM. Y APELL.:', params.nombre)
  row('DOCUMENTO:', params.documento)
  row('HORA DEL TURNO:', params.horaTurno || '-')
  row('FECHA DE ATENC.:', formatDateDDMMYYYY(params.fechaAtencionISO))
  row('ESPECIALIDAD:', params.especialidad)
  row('DIAGNÓSTICO:', params.diagnostico)

  // ===== Firmas: profesional y paciente en la misma fila =====
  y += 5

  const boxY = y
  const boxH = 20
  const gap = 8
  const innerW = W - 16
  const boxW = (innerW - gap) / 2

  const leftBoxX = 8
  const rightBoxX = 8 + boxW + gap

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)

  doc.text('FIRMA DEL PROFESIONAL Y SELLO', leftBoxX, boxY)
  doc.text('FIRMA Y ACLARACIÓN DEL PACIENTE', rightBoxX, boxY)

  doc.setLineWidth(0.25)
  doc.line(leftBoxX, boxY + 10, leftBoxX + boxW, boxY + 10)
  doc.line(rightBoxX, boxY + 10, rightBoxX + boxW, boxY + 10)

  // ===== Autoriza =====
  const autorizaY = boxY + boxH
  doc.setLineWidth(0.35)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('AUTORIZA:', leftX, autorizaY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(safeStr(params.autoriza) || '-', valueX, autorizaY)

  return doc
}

export default function BonosAtencionScreen({ affiliates }: Props) {
  const { user } = useAuth()

  const [afiliadoId, setAfiliadoId] = useState('')
  const [prestadorId, setPrestadorId] = useState('')

  const [turnoFechaISO, setTurnoFechaISO] = useState(getTodayBuenosAiresISO())
  const [fechaISO, setFechaISO] = useState(getTodayBuenosAiresISO())

  const [horaTurno, setHoraTurno] = useState('')

  const [obraSocial, setObraSocial] = useState('MEDIC')
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

  const autoriza = useMemo(() => {
    const dn = safeStr((user as unknown as { displayName?: string })?.displayName)
    const un = safeStr((user as unknown as { username?: string })?.username)
    return dn || un || 'Recepción'
  }, [user])

  const handleEmitir = async () => {
    if (!selectedAffiliate) return void Swal.fire('Error', 'Elegí un afiliado', 'error')
    if (!prestadorId) return void Swal.fire('Error', 'Elegí un prestador', 'error')
    if (!safeStr(practica)) return void Swal.fire('Error', 'Completá la especialidad/práctica', 'error')
    if (!safeStr(obraSocial)) return void Swal.fire('Error', 'Completá Obra social', 'error')

    const fechaAtencionISO = safeStr(turnoFechaISO) || safeStr(fechaISO)
    if (!fechaAtencionISO) return void Swal.fire('Error', 'Completá la fecha', 'error')

    const seguimiento = nextSeguimiento()

    const benefPlan = `${safeStr(selectedAffiliate.numeroAfiliado)}${
      selectedAffiliate.plan ? ` / ${safeStr(selectedAffiliate.plan)}` : ''
    }`

    try {
      const pdf = await generateBonoPdf({
        seguimiento,
        obraSocial: safeStr(obraSocial),
        benefPlan,
        nombre: safeStr(selectedAffiliate.nombreCompleto),
        documento: safeStr(selectedAffiliate.dni),
        fechaAtencionISO,
        horaTurno: safeStr(horaTurno),
        especialidad: safeStr(practica),
        diagnostico: safeStr(observaciones),
        prestador: prestadorNombre || '-',
        autoriza,
      })

      pdf.save(`Bono-${seguimiento}-${safeStr(selectedAffiliate.dni) || 'sin-dni'}-${fechaAtencionISO}.pdf`)
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
          <input
            type="date"
            className="input"
            value={turnoFechaISO}
            onChange={(e) => setTurnoFechaISO(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Fecha sugerida</span>
          <input type="date" className="input" value={fechaISO} onChange={(e) => setFechaISO(e.target.value)} />
        </label>

        <label className="field">
          <span className="field__label">Hora del turno</span>
          <input type="time" className="input" value={horaTurno} onChange={(e) => setHoraTurno(e.target.value)} />
        </label>

        <label className="field">
          <span className="field__label">Obra social</span>
          <input className="input" value={obraSocial} onChange={(e) => setObraSocial(e.target.value)} />
        </label>

        <label className="field">
          <span className="field__label">Especialidad / Práctica</span>
          <input className="input" value={practica} onChange={(e) => setPractica(e.target.value)} />
        </label>

        <label className="field field--full">
          <span className="field__label">Diagnóstico / Observaciones</span>
          <textarea className="input" rows={5} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </label>

        <label className="field field--full">
          <span className="field__label">Autoriza</span>
          <input className="input" value={autoriza} readOnly />
        </label>
      </div>
    </section>
  )
}
