import React, { useEffect, useMemo, useState } from 'react'
import type { Appointment, Affiliate } from '@/components/screens/homeModels'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'
import {
  fetchCajaEstado,
  cerrarCajaApi,
  fetchCajaByDate,
  type CajaEstadoDto,
  type CierreCajaDto,
  type CajaRow,
} from '@/api/turnosApi'
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
  value: (row: CajaRow) => string
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

const todayISODate = () => new Date().toISOString().slice(0, 10)

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
/* ======================= PDF BUILDER  ======================= */
async function generateCajaPdf(
  dateISO: string,
  rows: CajaRow[],
  mode: 'download' | 'preview' | 'tab'
): Promise<string | null> {
  if (!rows.length) return null

  const doc = new jsPDF({
    orientation: 'portrait', // ✅ vertical
    unit: 'pt',
    format: 'a4',
  })

  const PAGE_W = doc.internal.pageSize.getWidth()
  const PAGE_H = doc.internal.pageSize.getHeight()

  const marginX = 28
  const marginTop = 24
  const bottomLimit = PAGE_H - 56

  /* ---------- LOGO ---------- */
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

  /* ---------- HEADER ---------- */
  const headerY = logoBottomY + 22

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...MEDIC_BLUE)
  doc.text('CIERRE DE CAJA', PAGE_W / 2, headerY, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...TEXT_SOFT)

  // ✅ fuerza zona horaria BA (así no depende del navegador/servidor)
  const generado = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())

  doc.text(`Fecha: ${formatDateDisplay(dateISO)} · Generado: ${generado}`, PAGE_W / 2, headerY + 18, {
    align: 'center',
  })

  doc.setDrawColor(220)
  doc.setLineWidth(0.8)
  doc.line(marginX, headerY + 32, PAGE_W - marginX, headerY + 32)

  /* ---------- TABLE ---------- */
  const tableStartY = headerY + 48
  const padX = 6
  const padY = 6
  const lineH = 12

  // ✅ anchos base pensados para portrait (A4 vertical)
  const columns: PdfColumn[] = [
    { label: 'Fecha', width: 62, value: (r) => safeText(r.fechaDisplay) },
    { label: 'Nº Afiliado', width: 76, value: (r) => safeText(r.numeroAfiliado) },
    { label: 'DNI / CUIT', width: 82, value: (r) => safeText(r.dni) },
    { label: 'Apellido y nombre', width: 140, value: (r) => safeText(r.nombre) },
    { label: 'Prestador', width: 110, value: (r) => safeText(r.prestador) },
    { label: 'Esp. / Lab.', width: 150, value: (r) => safeText(r.practica) },
    {
      label: 'Monto',
      width: 76,
      align: 'right',
      value: (r) => `$ ${Number(r.monto || 0).toFixed(2)}`,
    },
  ]

  const rawW = columns.reduce((a, c) => a + c.width, 0)
  const maxW = PAGE_W - marginX * 2
  const scale = rawW > maxW ? maxW / rawW : 1

  // ✅ en portrait el “min width 70” te puede romper el ajuste; bajamos el mínimo
  const MIN_COL_W = 48

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
    doc.setFontSize(9.5)
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

  let total = 0

  for (const row of rows) {
    total += Number(row.monto || 0)

    const cellLines = cols.map(
      (c) => doc.splitTextToSize(c.value(row), c.width - padX * 2) as string[]
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

  /* ---------- TOTAL ---------- */
  y += 14
  if (y > bottomLimit) {
    doc.addPage()
    y = marginTop
  }

  doc.setDrawColor(...MEDIC_GREEN)
  doc.setLineWidth(1.4)
  doc.line(marginX, y, marginX + tableW, y)

  y += 24
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...MEDIC_GREEN)
  doc.text(`TOTAL: $ ${total.toFixed(2)}`, marginX + tableW, y, { align: 'right' })

  doc.setTextColor(...TEXT_DARK)

  if (mode === 'download') {
    doc.save(`cierre-caja-${dateISO}.pdf`)
    return null
  }

  const url = doc.output('bloburl').toString()
  if (mode === 'tab') window.open(url, '_blank', 'noopener,noreferrer')
  return url
}


/* ======================= COMPONENT ======================= */
export const CierreCajaScreen: React.FC<Props> = () => {
  const [mode, setMode] = useState<ViewMode>('main')
  const [estado, setEstado] = useState<CajaEstadoDto | null>(null)
  const [historyQuery, setHistoryQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const [closing, setClosing] = useState(false)

  const [manualDateISO, setManualDateISO] = useState<string>(todayISODate())

  const loadEstado = async () => {
    try {
      setLoading(true)
      const data = await fetchCajaEstado()
      setEstado(data)
      setManualDateISO(data.hoyFechaISO || todayISODate())
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
    [estado?.historial]
  )

  const historyFiltered = useMemo(() => {
    if (!historyQuery) return historyDates
    return historyDates.filter(
      (d) => d.includes(historyQuery) || formatDateDisplay(d).includes(historyQuery)
    )
  }, [historyDates, historyQuery])

  const rowsHoy = useMemo(() => estado?.hoy?.rows ?? [], [estado?.hoy?.rows])
  const totalHoy = useMemo(() => rowsHoy.reduce((acc, r) => acc + Number(r.monto || 0), 0), [rowsHoy])

  const cajaAyer = estado?.ayer ?? null

  const isAlreadyClosed = (fechaISO: string): boolean =>
    (estado?.historial ?? []).some((h) => h.fechaISO === fechaISO)

  const handleDownloadForDate = async (dateISO: string) => {
    try {
      const caja: CierreCajaDto = await fetchCajaByDate(dateISO)
      void generateCajaPdf(dateISO, caja.rows, 'download')
    } catch (err) {
      console.error('Error descargando caja', err)
    }
  }

  const handlePreviewForDate = async (dateISO: string) => {
    try {
      const caja: CierreCajaDto = await fetchCajaByDate(dateISO)
      const url = await generateCajaPdf(dateISO, caja.rows, 'preview')
      if (url) {
        setPreviewUrl(url)
        setShowPreview(true)
      }
    } catch (err) {
      console.error('Error previsualizando caja', err)
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

    let cajaLive: CierreCajaDto | null = null
    try {
      cajaLive = await fetchCajaByDate(fechaISOToClose)
    } catch {
      cajaLive = null
    }

    const rows = cajaLive?.rows ?? []
    const total = rows.reduce((acc, r) => acc + Number(r.monto || 0), 0)

    if (!rows.length) {
      await swal.fire({
        title: 'Sin movimientos',
        html: `No hay turnos recepcionados para cerrar la caja del día <b>${formatDateDisplay(
          fechaISOToClose
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
          <p style="margin:8px 0 0"><b>Total:</b> $ ${total.toFixed(2)}</p>
          <small>Se guardará en el historial y quedará persistida.</small>
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
      const cierre = await cerrarCajaApi(fechaISOToClose)

      const url = await generateCajaPdf(cierre.fechaISO, cierre.rows, 'preview')
      if (url) {
        setPreviewUrl(url)
        setShowPreview(true)
      }

      setEstado((prev) => {
        if (!prev) return prev

        const nextHistorial = [
          { fechaISO: cierre.fechaISO, total: cierre.total },
          ...(prev.historial ?? []).filter((h) => h.fechaISO !== cierre.fechaISO),
        ].sort((a, b) => b.fechaISO.localeCompare(a.fechaISO))

        const isClosingHoy = prev.hoy?.fechaISO === fechaISOToClose
        const isClosingAyer = prev.ayer?.fechaISO === fechaISOToClose

        return {
          ...prev,
          historial: nextHistorial,
          ...(isClosingHoy
            ? {
                hoy: { ...prev.hoy, rows: [] },
                ayer: { fechaISO: cierre.fechaISO, total: cierre.total, rows: cierre.rows },
              }
            : isClosingAyer
              ? {
                  ayer: { fechaISO: cierre.fechaISO, total: cierre.total, rows: cierre.rows },
                }
              : {}),
        }
      })

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

  // ===== Vista historial =====
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
                onClick={() => setShowPreview((v) => !v)}
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
              const resumen = estado?.historial?.find((h) => h.fechaISO === dateISO)
              if (!resumen) return null

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
                    <span className="cierre-caja-history__total">
                      Total: $ {Number(resumen.total).toFixed(2)}
                    </span>

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

  // ===== Vista principal cierre de caja =====
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
                if (!estado) return
                const url = await generateCajaPdf(estado.hoy.fechaISO, rowsHoy, 'preview')
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
            <span className="cierre-caja__col-monto">Monto</span>
          </div>

          <div className="cierre-caja__body">
            {rowsHoy.length === 0 && !loading && (
              <p className="cierre-caja__empty">Todavía no hay turnos recepcionados hoy.</p>
            )}

            {loading && <p className="cierre-caja__empty">Cargando cierre de caja…</p>}

            {rowsHoy.map((r, idx) => (
              <div
                key={`${estado?.hoy?.fechaISO ?? 'hoy'}-${r.numeroAfiliado}-${idx}`}
                className="cierre-caja__row"
              >
                <span>{r.fechaDisplay}</span>
                <span>{r.numeroAfiliado || '—'}</span>
                <span>{r.dni || '—'}</span>
                <span>{r.nombre}</span>
                <span>{r.prestador}</span>
                <span>{r.practica}</span>
                <span className="cierre-caja__col-monto">
                  {Number(r.monto) > 0 ? `$ ${Number(r.monto).toFixed(2)}` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="cierre-caja__total-bar">
            <span className="cierre-caja__total-label">Total</span>
            <span className="cierre-caja__total-value">$ {totalHoy.toFixed(2)}</span>
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

            {cajaAyer && cajaAyer.rows?.length ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="cierre-caja__yesterday-btn"
                  onClick={() => void generateCajaPdf(cajaAyer.fechaISO, cajaAyer.rows, 'download')}
                >
                  <span className="cierre-caja__pdf-tag">
                    {pdfIcon ? <img src={pdfIcon} alt="PDF" className="cierre-caja__pdf-icon" /> : 'PDF'}
                  </span>
                  <span className="cierre-caja__yesterday-date">{formatDateDisplay(cajaAyer.fechaISO)}</span>
                </button>

                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={async () => {
                    const url = await generateCajaPdf(cajaAyer.fechaISO, cajaAyer.rows, 'preview')
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
