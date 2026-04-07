import React, { useCallback, useEffect, useMemo, useState } from 'react'
import type { Appointment, Affiliate } from '@/components/screens/homeModels'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'
import { cerrarCajaApi, fetchCajaEstado, type CajaEstadoDto } from '@/api/turnosApi'
import pdfIcon from '@/assets/icons/pdf.png'
import medicLogo from '@/assets/logo-medic-hd.png'

/* ======================= BRAND CONSTANTS ======================= */

const MEDIC_BLUE: [number, number, number] = [0, 91, 191]
const LIGHT_GRAY: [number, number, number] = [245, 245, 245]
const TEXT_DARK: [number, number, number] = [17, 17, 17]
const TEXT_SOFT: [number, number, number] = [102, 102, 102]
const MEDIC_GREEN: [number, number, number] = [47, 174, 59]

/* ======================= TYPES ======================= */
type ViewMode = 'main' | 'history'

interface Props {
  appointments: Appointment[]
  affiliates: Affiliate[]
}

type PdfAlign = 'left' | 'right' | 'center'

type PdfColumn = {
  label: string
  width: number
  align?: PdfAlign
  value: (row: CajaLocalRow) => string
}

type CajaLocalRow = {
  fechaDisplay: string
  numeroAfiliado: string
  dni: string
  nombre: string
  prestador: string
  practica: string
  monto: number
  mpPagado: boolean
}

type CajaDaySummary = {
  fechaISO: string
  rows: CajaLocalRow[]
  efectivoTotal: number
  mercadoPagoTotal: number
  totalInformado: number
}

/* ======================= HELPERS ======================= */
const formatDateDisplay = (iso: string): string => {
  const base = iso.includes('T') ? iso.split('T')[0] : iso
  const [y, m, d] = base.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y.slice(2)}`
}

const safeText = (v: unknown): string => {
  if (v === null || v === undefined) return '—'
  const s = String(v).trim()
  return s.length ? s : '—'
}

const getLocalISODate = () => {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

const shiftISODate = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + days)

  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const buildEmptySummary = (fechaISO: string): CajaDaySummary => ({
  fechaISO,
  rows: [],
  efectivoTotal: 0,
  mercadoPagoTotal: 0,
  totalInformado: 0,
})

const swal = Swal.mixin({
  buttonsStyling: false,
  customClass: {
    popup: 'card',
    title: 'card__title',
    htmlContainer: 'card__subtitle',
    confirmButton: 'btn btn--danger btn--sm',
    cancelButton: 'btn btn--outline btn--sm',
  },
})

/* ======================= PDF BUILDER  ======================= */
async function generateCajaPdf(
  summary: CajaDaySummary,
  mode: 'download' | 'preview' | 'tab',
): Promise<string | null> {
  if (!summary.rows.length) return null

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const PAGE_W = doc.internal.pageSize.getWidth()
  const PAGE_H = doc.internal.pageSize.getHeight()

  const marginX = 28
  const marginTop = 24
  const bottomLimit = PAGE_H - 56

  let logoBottomY = marginTop

  try {
    const img = new Image()
    img.src = medicLogo
    await img.decode()

    const logoW = 150
    const logoH = (img.height / img.width) * logoW

    doc.addImage(img, 'PNG', (PAGE_W - logoW) / 2, marginTop, logoW, logoH)
    logoBottomY = marginTop + logoH
  } catch {
    logoBottomY = marginTop
  }

  const headerY = logoBottomY + 22

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...MEDIC_BLUE)
  doc.text('CIERRE DE CAJA', PAGE_W / 2, headerY, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_SOFT)

  const generado = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())

  doc.text(
    `Fecha: ${formatDateDisplay(summary.fechaISO)} · Generado: ${generado}`,
    PAGE_W / 2,
    headerY + 18,
    { align: 'center' },
  )

  doc.setDrawColor(220)
  doc.setLineWidth(0.8)
  doc.line(marginX, headerY + 32, PAGE_W - marginX, headerY + 32)

  const tableStartY = headerY + 48
  const padX = 6
  const padY = 6
  const lineH = 12

  const columns: PdfColumn[] = [
    { label: 'Fecha', width: 58, value: (r) => safeText(r.fechaDisplay) },
    { label: 'Nº Afiliado', width: 70, value: (r) => safeText(r.numeroAfiliado) },
    { label: 'DNI / CUIT', width: 78, value: (r) => safeText(r.dni) },
    { label: 'Apellido y nombre', width: 118, value: (r) => safeText(r.nombre) },
    { label: 'Prestador', width: 84, value: (r) => safeText(r.prestador) },
    { label: 'Esp. / Lab.', width: 126, value: (r) => safeText(r.practica) },
    { label: 'Pago', width: 86, value: (r) => (r.mpPagado ? 'Mercado Pago' : 'Efectivo') },
    {
      label: 'Monto',
      width: 62,
      align: 'right',
      value: (r) => `$ ${Number(r.monto || 0).toFixed(2)}`,
    },
  ]

  const rawW = columns.reduce((a, c) => a + c.width, 0)
  const maxW = PAGE_W - marginX * 2
  const scale = rawW > maxW ? maxW / rawW : 1
  const MIN_COL_W = 44

  const cols = columns.map((c) => ({
    ...c,
    width: Math.max(MIN_COL_W, Math.floor(c.width * scale)),
  }))

  const tableW = cols.reduce((a, c) => a + c.width, 0)

  let y = tableStartY

  const drawHeader = () => {
    doc.setFillColor(...MEDIC_BLUE)
    doc.rect(marginX, y, tableW, 26, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.2)
    doc.setTextColor(255, 255, 255)

    let x = marginX
    for (const c of cols) {
      doc.text(c.label, x + padX, y + 18)
      x += c.width
    }

    y += 26
    doc.setTextColor(...TEXT_DARK)
  }

  drawHeader()

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  for (const row of summary.rows) {
    const cellLines = cols.map(
      (c) => doc.splitTextToSize(c.value(row), c.width - padX * 2) as string[],
    )

    const maxLines = Math.max(...cellLines.map((l) => l.length))
    const rowH = Math.max(22, padY * 2 + maxLines * lineH)

    if (y + rowH > bottomLimit) {
      doc.addPage()
      y = marginTop
      drawHeader()
    }

    doc.setFillColor(...LIGHT_GRAY)
    doc.rect(marginX, y, tableW, rowH, 'F')
    doc.setDrawColor(230)
    doc.rect(marginX, y, tableW, rowH)

    let x = marginX
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i]
      const lines = cellLines[i]
      const tx = c.align === 'right' ? x + c.width - padX : x + padX
      const ty = y + padY + lineH
      doc.text(lines, tx, ty, { align: c.align ?? 'left' })
      x += c.width
    }

    y += rowH
  }

  y += 14
  if (y > bottomLimit) {
    doc.addPage()
    y = marginTop
  }

  doc.setDrawColor(...MEDIC_GREEN)
  doc.setLineWidth(1.4)
  doc.line(marginX, y, marginX + tableW, y)

  y += 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_SOFT)
  doc.text(`Mercado Pago informado: $ ${summary.mercadoPagoTotal.toFixed(2)}`, marginX + tableW, y, {
    align: 'right',
  })

  y += 20
  doc.setFontSize(14)
  doc.setTextColor(...MEDIC_GREEN)
  doc.text(`TOTAL EFECTIVO: $ ${summary.efectivoTotal.toFixed(2)}`, marginX + tableW, y, {
    align: 'right',
  })

  doc.setTextColor(...TEXT_DARK)

  if (mode === 'download') {
    doc.save(`cierre-caja-${summary.fechaISO}.pdf`)
    return null
  }

  const url = doc.output('bloburl').toString()
  if (mode === 'tab') window.open(url, '_blank', 'noopener,noreferrer')
  return url
}

/* ======================= COMPONENT ======================= */
export const CierreCajaScreen: React.FC<Props> = ({ appointments, affiliates }) => {
  const [mode, setMode] = useState<ViewMode>('main')
  const [estado, setEstado] = useState<CajaEstadoDto | null>(null)
  const [historyQuery, setHistoryQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const [closing, setClosing] = useState(false)

  const todayISO = useMemo(() => getLocalISODate(), [])
  const [manualDateISO, setManualDateISO] = useState<string>(todayISO)

  const affiliateById = useMemo(
    () => new Map(affiliates.map((affiliate) => [affiliate.id, affiliate] as const)),
    [affiliates],
  )

  const cajaSummaryByDate = useMemo(() => {
    const map = new Map<string, CajaDaySummary>()

    appointments
      .filter((appointment) => appointment.estado === 'recepcionado')
      .forEach((appointment) => {
        const fechaISO = String(appointment.date ?? '').slice(0, 10)
        if (!fechaISO) return

        const affiliate = affiliateById.get(appointment.affiliateId)
        const practica =
          appointment.tipoAtencion === 'laboratorio'
            ? appointment.laboratorio ?? '—'
            : appointment.especialidad ?? '—'

        const montoBase = Number(appointment.monto ?? 0)
        const montoMp =
          appointment.mpPagado && typeof appointment.mpMonto === 'number' && appointment.mpMonto > 0
            ? Number(appointment.mpMonto)
            : montoBase

        const montoRow = appointment.mpPagado ? montoMp : montoBase

        const row: CajaLocalRow = {
          fechaDisplay: formatDateDisplay(fechaISO),
          numeroAfiliado: affiliate?.numeroAfiliado ?? '—',
          dni: affiliate?.dni ?? appointment.affiliateDni ?? '—',
          nombre: affiliate?.nombreCompleto ?? appointment.affiliateName ?? '—',
          prestador: appointment.prestador ?? '—',
          practica: practica || '—',
          monto: montoRow,
          mpPagado: Boolean(appointment.mpPagado),
        }

        const current = map.get(fechaISO) ?? buildEmptySummary(fechaISO)
        current.rows.push(row)

        if (row.mpPagado) {
          current.mercadoPagoTotal += row.monto
        } else {
          current.efectivoTotal += row.monto
        }

        current.totalInformado += row.monto
        map.set(fechaISO, current)
      })

    map.forEach((summary) => {
      summary.rows.sort((a, b) => a.nombre.localeCompare(b.nombre))
    })

    return map
  }, [affiliateById, appointments])

  const getSummaryForDate = useCallback(
    (fechaISO: string): CajaDaySummary => cajaSummaryByDate.get(fechaISO) ?? buildEmptySummary(fechaISO),
    [cajaSummaryByDate],
  )

  const loadEstado = async () => {
    try {
      setLoading(true)
      const data = await fetchCajaEstado()
      setEstado(data)
      setManualDateISO(data.hoyFechaISO || todayISO)
    } catch (err) {
      console.error('Error cargando estado de caja', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEstado()
  }, [])

  const historyDates = useMemo(
    () => (estado?.historial ?? []).map((h) => h.fechaISO).sort((a, b) => b.localeCompare(a)),
    [estado?.historial],
  )

  const historyFiltered = useMemo(() => {
    if (!historyQuery) return historyDates
    return historyDates.filter(
      (dateISO) => dateISO.includes(historyQuery) || formatDateDisplay(dateISO).includes(historyQuery),
    )
  }, [historyDates, historyQuery])

  const summaryHoy = useMemo(
    () => getSummaryForDate(estado?.hoyFechaISO || todayISO),
    [estado?.hoyFechaISO, getSummaryForDate, todayISO],
  )
  const rowsHoy = summaryHoy.rows
  const totalHoy = summaryHoy.efectivoTotal
  const totalHoyMp = summaryHoy.mercadoPagoTotal

  const ayerISO = estado?.ayerFechaISO || shiftISODate(estado?.hoyFechaISO || todayISO, -1)
  const cajaAyer = useMemo(() => getSummaryForDate(ayerISO), [ayerISO, getSummaryForDate])

  const isAlreadyClosed = (fechaISO: string): boolean =>
    (estado?.historial ?? []).some((h) => h.fechaISO === fechaISO)

  const handleDownloadForDate = async (fechaISO: string) => {
    const summary = getSummaryForDate(fechaISO)
    if (!summary.rows.length) {
      await swal.fire({
        title: 'Sin movimientos',
        text: 'No hay movimientos recepcionados para esa fecha.',
        icon: 'info',
      })
      return
    }

    void generateCajaPdf(summary, 'download')
  }

  const handlePreviewForDate = async (fechaISO: string) => {
    const summary = getSummaryForDate(fechaISO)
    if (!summary.rows.length) {
      await swal.fire({
        title: 'Sin movimientos',
        text: 'No hay movimientos recepcionados para esa fecha.',
        icon: 'info',
      })
      return
    }

    const url = await generateCajaPdf(summary, 'preview')
    if (url) {
      setPreviewUrl(url)
      setShowPreview(true)
    }
  }

  const handleManualClose = async (fechaISOToClose: string) => {
    if (!estado) return

    if (isAlreadyClosed(fechaISOToClose)) {
      await swal.fire({
        title: 'Caja ya cerrada',
        html: `La caja del día <b>${formatDateDisplay(fechaISOToClose)}</b> ya está cerrada en el historial.`,
        icon: 'info',
      })
      return
    }

    const summary = getSummaryForDate(fechaISOToClose)

    if (!summary.rows.length) {
      await swal.fire({
        title: 'Sin movimientos',
        html: `No hay turnos recepcionados para cerrar la caja del día <b>${formatDateDisplay(
          fechaISOToClose,
        )}</b>.`,
        icon: 'warning',
      })
      return
    }

    const confirm = await swal.fire({
      title: 'Confirmar cierre de caja',
      html: `
        <div style="text-align:left">
          <p>¿Confirmás cerrar la caja del día <b>${formatDateDisplay(fechaISOToClose)}</b>?</p>
          <p style="margin:8px 0 0"><b>Total efectivo:</b> $ ${summary.efectivoTotal.toFixed(2)}</p>
          <p style="margin:6px 0 0"><b>Mercado Pago informado:</b> $ ${summary.mercadoPagoTotal.toFixed(2)}</p>
          <small>Los pagos Mercado Pago se guardan como referencia y no suman al total de efectivo.</small>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cerrar caja',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    })

    if (!confirm.isConfirmed) return

    try {
      setClosing(true)

      await cerrarCajaApi(fechaISOToClose)

      const url = await generateCajaPdf(summary, 'preview')
      if (url) {
        setPreviewUrl(url)
        setShowPreview(true)
      }

      await loadEstado()

      await swal.fire({
        title: 'Caja cerrada',
        html: `La caja del día <b>${formatDateDisplay(fechaISOToClose)}</b> fue cerrada correctamente.`,
        icon: 'success',
        timer: 1400,
        showConfirmButton: false,
      })
    } catch (err) {
      console.error('Error cerrando caja', err)
      await swal.fire({
        title: 'Error',
        text: 'Ocurrió un error al cerrar la caja.',
        icon: 'error',
      })
    } finally {
      setClosing(false)
    }
  }

  if (mode === 'history') {
    return (
      <section className="cierre-caja-screen">
        <div className="card card--stretch cierre-caja-history">
          <header className="card__header">
            <div>
              <h2 className="card__title">Cajas anteriores</h2>
              <p className="card__subtitle">Descargá o previsualizá cierres por fecha.</p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--ghost" onClick={() => setMode('main')}>
                ← Volver a cierre de caja
              </button>

              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setShowPreview((value) => !value)}
              >
                {showPreview ? 'Ocultar previsualización' : 'Mostrar previsualización'}
              </button>
            </div>
          </header>

          <div className="cierre-caja-history__tools">
            <input
              type="text"
              className="input"
              placeholder="Buscar por fecha (dd/mm/aa o 2025-12-01)…"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
            />
          </div>

          <div className="cierre-caja-history__list">
            {historyFiltered.length === 0 && (
              <p className="cierre-caja__empty">Todavía no hay cierres de caja para mostrar.</p>
            )}

            {historyFiltered.map((dateISO) => {
              const resumenBackend = estado?.historial?.find((item) => item.fechaISO === dateISO)
              const resumenLocal = getSummaryForDate(dateISO)
              const totalEfectivo =
                resumenLocal.rows.length > 0 ? resumenLocal.efectivoTotal : Number(resumenBackend?.total ?? 0)
              const totalMp = resumenLocal.rows.length > 0 ? resumenLocal.mercadoPagoTotal : 0

              return (
                <div
                  key={dateISO}
                  className="cierre-caja-history__item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void handlePreviewForDate(dateISO)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    title="Previsualizar"
                  >
                    <span className="cierre-caja__pdf-tag">
                      {pdfIcon ? <img src={pdfIcon} alt="PDF" className="cierre-caja__pdf-icon" /> : 'PDF'}
                    </span>
                    <span className="cierre-caja-history__date">{formatDateDisplay(dateISO)}</span>
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="cierre-caja-history__total">Efectivo: $ {totalEfectivo.toFixed(2)}</span>

                    {totalMp > 0 && (
                      <span className="cierre-caja-history__mp">Mercado Pago: $ {totalMp.toFixed(2)}</span>
                    )}

                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => void handlePreviewForDate(dateISO)}
                    >
                      Previsualizar
                    </button>

                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => void handleDownloadForDate(dateISO)}
                    >
                      Descargar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {showPreview && previewUrl && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong>Previsualización</strong>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setPreviewUrl(null)}
                >
                  limpiar
                </button>
              </div>

              <iframe
                title="PDF Preview"
                src={previewUrl}
                style={{
                  width: '100%',
                  height: '70vh',
                  border: '1px solid rgba(0,0,0,0.12)',
                  borderRadius: 12,
                  background: '#fff',
                }}
              />
            </div>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="cierre-caja-screen">
      <div className="card cierre-caja">
        <header className="card__header card__header--compact">
          <div>
            <h2 className="card__title">Cierre de caja</h2>
            <p className="card__subtitle">Turnos recepcionados del día de hoy</p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={!estado || rowsHoy.length === 0}
              onClick={async () => {
                const url = await generateCajaPdf(summaryHoy, 'preview')
                if (url) {
                  setPreviewUrl(url)
                  setShowPreview(true)
                }
              }}
            >
              Previsualizar
            </button>

            <button
              type="button"
              className="btn btn--danger btn--sm"
              disabled={!estado || rowsHoy.length === 0 || closing}
              onClick={() => {
                if (!estado) return
                void handleManualClose(estado.hoy.fechaISO)
              }}
            >
              {closing ? 'Cerrando…' : 'Cerrar caja (hoy)'}
            </button>
          </div>
        </header>

        <p className="cierre-caja__note">
          Los pagos marcados como Mercado Pago se muestran en el cierre como referencia, pero no suman al
          total efectivo de caja.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--color-ink-soft)' }}>Cerrar caja por fecha:</span>
            <input
              type="date"
              className="input"
              style={{ maxWidth: 180 }}
              value={manualDateISO}
              onChange={(e) => setManualDateISO(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={!manualDateISO || closing}
            onClick={() => void handleManualClose(manualDateISO)}
            title="Útil si se olvidaron cerrar una caja de un día anterior"
          >
            {closing ? 'Cerrando…' : 'Cerrar esa fecha'}
          </button>

          {manualDateISO && isAlreadyClosed(manualDateISO) && (
            <span style={{ fontSize: 12, color: '#0f766e' }}>✔ Esa fecha ya está cerrada (historial)</span>
          )}
        </div>

        <div className="cierre-caja__table">
          <div className="cierre-caja__header-row">
            <span>Fecha</span>
            <span>Nº afiliado</span>
            <span>DNI / CUIT</span>
            <span>Apellido y nombre</span>
            <span>Prestador</span>
            <span>Especialidad / Laboratorio</span>
            <span>Pago</span>
            <span className="cierre-caja__col-monto">Monto</span>
          </div>

          <div className="cierre-caja__body">
            {rowsHoy.length === 0 && !loading && (
              <p className="cierre-caja__empty">Todavía no hay turnos recepcionados hoy.</p>
            )}

            {loading && <p className="cierre-caja__empty">Cargando cierre de caja…</p>}

            {rowsHoy.map((row, idx) => (
              <div
                key={`${summaryHoy.fechaISO}-${row.numeroAfiliado}-${idx}`}
                className="cierre-caja__row"
              >
                <span>{row.fechaDisplay}</span>
                <span>{row.numeroAfiliado || '—'}</span>
                <span>{row.dni || '—'}</span>
                <span>{row.nombre}</span>
                <span>{row.prestador}</span>
                <span>{row.practica}</span>
                <span>
                  <span
                    className={`cierre-caja__payment-tag ${
                      row.mpPagado ? 'cierre-caja__payment-tag--digital' : 'cierre-caja__payment-tag--cash'
                    }`}
                  >
                    {row.mpPagado ? 'Mercado Pago' : 'Efectivo'}
                  </span>
                </span>
                <span className="cierre-caja__col-monto">
                  {row.monto > 0 ? `$ ${row.monto.toFixed(2)}` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="cierre-caja__total-bar">
            <div className="cierre-caja__total-group">
              <span className="cierre-caja__total-label">Mercado Pago</span>
              <span className="cierre-caja__total-value cierre-caja__total-value--soft">
                $ {totalHoyMp.toFixed(2)}
              </span>
            </div>

            <div className="cierre-caja__total-group">
              <span className="cierre-caja__total-label">Total efectivo</span>
              <span className="cierre-caja__total-value">$ {totalHoy.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {showPreview && previewUrl && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong>Previsualización</strong>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setPreviewUrl(null)}
              >
                limpiar
              </button>
            </div>

            <iframe
              title="PDF Preview"
              src={previewUrl}
              style={{
                width: '100%',
                height: '70vh',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 12,
                background: '#fff',
              }}
            />
          </div>
        )}
      </div>

      <div className="cierre-caja__yesterday card">
        <div className="cierre-caja__yesterday-row">
          <div className="cierre-caja__yesterday-info">
            <span className="cierre-caja__yesterday-label">Caja del día de ayer:</span>

            {cajaAyer.rows.length > 0 ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="cierre-caja__yesterday-btn"
                  onClick={() => void generateCajaPdf(cajaAyer, 'download')}
                >
                  <span className="cierre-caja__pdf-tag">
                    {pdfIcon ? <img src={pdfIcon} alt="PDF" className="cierre-caja__pdf-icon" /> : 'PDF'}
                  </span>
                  <span className="cierre-caja__yesterday-date">{formatDateDisplay(cajaAyer.fechaISO)}</span>
                </button>

                <span className="cierre-caja__yesterday-total">
                  Efectivo: $ {cajaAyer.efectivoTotal.toFixed(2)}
                </span>

                {cajaAyer.mercadoPagoTotal > 0 && (
                  <span className="cierre-caja__yesterday-mp">
                    Mercado Pago: $ {cajaAyer.mercadoPagoTotal.toFixed(2)}
                  </span>
                )}

                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={async () => {
                    const url = await generateCajaPdf(cajaAyer, 'preview')
                    if (url) {
                      setPreviewUrl(url)
                      setShowPreview(true)
                    }
                  }}
                >
                  Previsualizar
                </button>
              </div>
            ) : (
              <span className="cierre-caja__yesterday-empty">Sin datos de caja para ayer.</span>
            )}
          </div>

          <div className="cierre-caja__yesterday-actions">
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setMode('history')}>
              ver anteriores
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
