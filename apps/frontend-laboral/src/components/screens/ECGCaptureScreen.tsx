import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'



import {
  bytesToAsciiPreview,
  bytesToHexPreview,
  hexToBytes,
  isWebSerialSupported,
  requestAndOpenPort,
  setPortSignals,
  writeBytes,
  type SerialSession,
} from '@/lib/ecg/webSerial'

type CaptureState = 'idle' | 'connected' | 'capturing' | 'stopped'
type UploadResult = { ok: true; fileUrl?: string } | { ok: false; error: string }

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const kb = n / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(2)} MB`
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function computeTopBytes(u8: Uint8Array): { unique: number; top: Array<{ b: number; n: number; p: number }> } {
  const map = new Map<number, number>()
  for (let i = 0; i < u8.length; i++) {
    const v = u8[i]
    map.set(v, (map.get(v) ?? 0) + 1)
  }
  const total = u8.length || 1
  const arr = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([b, n]) => ({ b, n, p: n / total }))
  return { unique: map.size, top: arr }
}

/** TODO: reemplazar por tu endpoint real */
async function uploadECGRaw(params: {
  patientId: string
  filename: string
  mime: string
  bytes: Uint8Array
}): Promise<UploadResult> {
  const url = `/api/laboral/patients/${encodeURIComponent(params.patientId)}/ecg`

  const blob = new Blob([toArrayBuffer(params.bytes)], { type: params.mime })
  const form = new FormData()
  form.append('file', blob, params.filename)

  const res = await fetch(url, { method: 'POST', body: form })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return { ok: false, error: txt || `HTTP ${res.status}` }
  }

  const data: unknown = await res.json().catch(() => null)
  let fileUrl: string | undefined
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const a = obj['fileUrl']
    const b = obj['url']
    if (typeof a === 'string') fileUrl = a
    else if (typeof b === 'string') fileUrl = b
  }

  return { ok: true, fileUrl }
}

/* ===========================
   PDF "tira" (debug)
   =========================== */

function drawEcgGrid(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(255, 150, 150)
  doc.setLineWidth(0.05)

  for (let i = 0; i <= w; i += 1) {
    const xx = x + i
    doc.line(xx, y, xx, y + h)
  }
  for (let j = 0; j <= h; j += 1) {
    const yy = y + j
    doc.line(x, yy, x + w, yy)
  }

  doc.setDrawColor(255, 90, 90)
  doc.setLineWidth(0.12)
  for (let i = 0; i <= w; i += 5) {
    const xx = x + i
    doc.line(xx, y, xx, y + h)
  }
  for (let j = 0; j <= h; j += 5) {
    const yy = y + j
    doc.line(x, yy, x + w, yy)
  }

  doc.setDrawColor(40, 40, 40)
  doc.setLineWidth(0.25)
}

function makeSeries(bytes: Uint8Array, mode: 'raw' | 'delta', dataBits: 7 | 8): number[] {
  if (!bytes.length) return []
  const vals: number[] = []
  if (mode === 'raw') {
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i]
      const v = dataBits === 7 ? ((b & 0x7f) - 64) : (b - 128)
      vals.push(v)
    }
    return vals
  }

  let prev = dataBits === 7 ? ((bytes[0] & 0x7f) - 64) : (bytes[0] - 128)
  for (let i = 1; i < bytes.length; i++) {
    const cur = dataBits === 7 ? ((bytes[i] & 0x7f) - 64) : (bytes[i] - 128)
    vals.push(cur - prev)
    prev = cur
  }
  return vals
}

function downsampleToWidth(series: number[], targetPoints: number): number[] {
  if (series.length <= targetPoints) return series
  const out: number[] = []
  const step = series.length / targetPoints
  for (let i = 0; i < targetPoints; i++) {
    const idx = Math.floor(i * step)
    out.push(series[idx] ?? 0)
  }
  return out
}

function plotStrip(doc: jsPDF, series: number[], x: number, y: number, w: number, h: number) {
  if (series.length < 2) return
  const midY = y + h / 2

  let maxAbs = 1
  for (let i = 0; i < series.length; i++) {
    const a = Math.abs(series[i])
    if (a > maxAbs) maxAbs = a
  }
  const scale = (h * 0.42) / maxAbs

  const points = downsampleToWidth(series, Math.floor(w * 4))

  let prevX = x
  let prevY = midY - points[0] * scale

  for (let i = 1; i < points.length; i++) {
    const xx = x + (i * (w / (points.length - 1)))
    const yy = midY - points[i] * scale
    doc.line(prevX, prevY, xx, yy)
    prevX = xx
    prevY = yy
  }
}

function downloadStripPdf(params: {
  bytes: Uint8Array
  config: {
    baudRate: number
    dataBits: 7 | 8
    parity: 'none' | 'even' | 'odd'
    stopBits: 1 | 2
    flowControl: 'none' | 'hardware'
    dtr: boolean
    rts: boolean
  }
  patientId: string
}) {
  const { bytes, config, patientId } = params
  const stats = computeTopBytes(bytes)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 10
  const pageW = 210
  const stripW = pageW - margin * 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('ECG - PDF (tira debug)', margin, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Paciente/ID: ${patientId || '-'}`, margin, 18)
  doc.text(
    `Config: ${config.baudRate} | ${config.dataBits}${config.parity[0].toUpperCase()}${config.stopBits} | Flow:${config.flowControl} | DTR:${config.dtr ? 'ON' : 'OFF'} RTS:${config.rts ? 'ON' : 'OFF'}`,
    margin,
    23
  )
  doc.text(`Bytes: ${bytes.length} (${formatBytes(bytes.length)}) | Únicos: ${stats.unique}`, margin, 28)

  const topLine = stats.top
    .map((t) => `0x${t.b.toString(16).padStart(2, '0').toUpperCase()} ${(t.p * 100).toFixed(1)}%`)
    .join(' | ')
  doc.text(`Top bytes: ${topLine || '-'}`, margin, 33)

  const stripX = margin
  const stripY = 40
  const stripH = 90

  doc.setFont('helvetica', 'bold')
  doc.text('Tira (RAW bytes → onda) [debug]', stripX, stripY - 3)
  drawEcgGrid(doc, stripX, stripY, stripW, stripH)
  plotStrip(doc, makeSeries(bytes, 'raw', config.dataBits), stripX, stripY, stripW, stripH)

  const strip2Y = stripY + stripH + 20
  doc.setFont('helvetica', 'bold')
  doc.text('Tira (DELTA entre muestras) [debug]', stripX, strip2Y - 3)
  drawEcgGrid(doc, stripX, strip2Y, stripW, stripH)
  plotStrip(doc, makeSeries(bytes, 'delta', config.dataBits), stripX, strip2Y, stripW, stripH)

  doc.addPage()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('HEX (primeros 2048 bytes) [debug]', margin, 12)

  doc.setFont('courier', 'normal')
  doc.setFontSize(8)
  const hex = bytesToHexPreview(bytes.slice(0, 2048), 2048)
  const lines = doc.splitTextToSize(hex, pageW - margin * 2)
  doc.text(lines, margin, 18)

  doc.save(`ecg_strip_debug_${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`)
}

export default function ECGCaptureScreen() {
  const supported = useMemo(() => isWebSerialSupported(), [])

  const [patientId, setPatientId] = useState('')
  const [baudRate, setBaudRate] = useState<number>(9600)
  const [dataBits, setDataBits] = useState<7 | 8>(7)
  const [parity, setParity] = useState<'none' | 'even' | 'odd'>('even')
  const [stopBits, setStopBits] = useState<1 | 2>(1)
  const [flowControl, setFlowControl] = useState<'none' | 'hardware'>('none')
  const [dtr, setDtr] = useState(true)
  const [rts, setRts] = useState(true)

  const [state, setState] = useState<CaptureState>('idle')
  const [session, setSession] = useState<SerialSession | null>(null)

  const [bytes, setBytes] = useState<Uint8Array>(new Uint8Array())
  const bytesRef = useRef<Uint8Array>(new Uint8Array())
  const [asciiPreview, setAsciiPreview] = useState('')
  const [hexPreview, setHexPreview] = useState('')
  const [stats, setStats] = useState<{ unique: number; top: Array<{ b: number; n: number; p: number }> }>({
    unique: 0,
    top: [],
  })
  const [lastChunkAt, setLastChunkAt] = useState<number | null>(null)

  const connectingRef = useRef(false)
  const disconnectingRef = useRef(false)
  const captureAbortRef = useRef(false)

  const canConnect = supported && (state === 'idle' || state === 'stopped')
  const canStart = !!session && (state === 'connected' || state === 'stopped')
  const canStop = state === 'capturing'
  const canDisconnect = !!session

  const appendBytes = useCallback((chunk: Uint8Array) => {
    const prev = bytesRef.current
    const next = new Uint8Array(prev.length + chunk.length)
    next.set(prev, 0)
    next.set(chunk, prev.length)
    bytesRef.current = next

    setBytes(next)
    setAsciiPreview(bytesToAsciiPreview(next))
    setHexPreview(bytesToHexPreview(next))
    setStats(computeTopBytes(next))
    setLastChunkAt(Date.now())
  }, [])

  const disconnectHard = useCallback(
    async (reason?: string) => {
      if (disconnectingRef.current) return
      disconnectingRef.current = true

      captureAbortRef.current = true

      try {
        if (session) {
          // 1) Cancelar lectura sí o sí
          try {
            await session.reader.cancel()
          } catch {
            void 0
          }

          // 2) Cerrar fuerte (incluye close + delay en webSerial.ts)
          try {
            await session.close()
          } catch {
            void 0
          }
        }
      } finally {
        setSession(null)
        setState('idle')
        await sleep(250) // CH340 necesita respiro para re-open
        captureAbortRef.current = false
        disconnectingRef.current = false
      }

      if (reason) {
        await Swal.fire({
          icon: 'info',
          title: 'Puerto reseteado',
          text: reason,
          timer: 1400,
          showConfirmButton: false,
        })
      }
    },
    [session]
  )

  const connect = useCallback(async () => {
    if (!supported) {
      await Swal.fire({
        icon: 'error',
        title: 'Tu navegador no soporta Web Serial',
        text: 'Usá Chrome o Edge (o hacemos un bridge con Node/serialport).',
      })
      return
    }
    if (connectingRef.current) return
    connectingRef.current = true

    try {
      // Si quedó una sesión colgada, reseteamos antes de abrir
      if (session) await disconnectHard()

      // Asegura que no estés capturando
      captureAbortRef.current = false

      const s = await requestAndOpenPort({
        baudRate,
        dataBits,
        stopBits,
        parity,
        flowControl,
      })

      await setPortSignals(s.port, dtr, rts)

      setSession(s)
      setState('connected')

      await Swal.fire({
        icon: 'success',
        title: 'Conectado',
        text: `Abierto: ${baudRate} | ${dataBits}${parity[0].toUpperCase()}${stopBits} | Flow:${flowControl} | DTR:${dtr ? 'ON' : 'OFF'} RTS:${rts ? 'ON' : 'OFF'}`,
        timer: 1300,
        showConfirmButton: false,
      })
    } catch (err) {
      // Intento extra: a veces el driver tarda
      await sleep(300)
      const msg = err instanceof Error ? err.message : String(err)
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo conectar',
        text:
          msg +
          '\n\nCausa común: el COM quedó ocupado. Solución: tocá "Reset puerto", o desenchufá/enchufá el USB-RS232 y reintentá.',
      })
    } finally {
      connectingRef.current = false
    }
  }, [supported, session, disconnectHard, baudRate, dataBits, stopBits, parity, flowControl, dtr, rts])

  const startCapture = useCallback(async () => {
    if (!session) return

    bytesRef.current = new Uint8Array()
    setBytes(new Uint8Array())
    setAsciiPreview('')
    setHexPreview('')
    setStats({ unique: 0, top: [] })
    setLastChunkAt(null)

    captureAbortRef.current = false
    setState('capturing')

    ;(async () => {
      try {
        while (true) {
          if (captureAbortRef.current) break
          const { value, done } = await session.reader.read()
          if (done) break
          if (value && value.length) appendBytes(value)
        }
      } catch {
        // si desconectaron/cancelaron, no spameamos alert
      } finally {
        // si no estamos "idle" por reset, dejamos como stopped
        setState((prev) => (prev === 'idle' ? 'idle' : 'stopped'))
      }
    })()
  }, [appendBytes, session])

  const stopCapture = useCallback(async () => {
    captureAbortRef.current = true

    try {
      await session?.reader.cancel()
    } catch {
      void 0
    }

    setState('stopped')
    const u = computeTopBytes(bytesRef.current).unique
    await Swal.fire({
      icon: 'success',
      title: 'Captura finalizada',
      text: `Total: ${formatBytes(bytesRef.current.length)} | únicos: ${u}`,
      timer: 1200,
      showConfirmButton: false,
    })
  }, [session])

  const clear = useCallback(() => {
    bytesRef.current = new Uint8Array()
    setBytes(new Uint8Array())
    setAsciiPreview('')
    setHexPreview('')
    setStats({ unique: 0, top: [] })
    setLastChunkAt(null)
  }, [])

  const downloadRaw = useCallback(() => {
    const raw = bytesRef.current
    if (!raw.length) return
    const blob = new Blob([toArrayBuffer(raw)], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ecg_${new Date().toISOString().replace(/[:.]/g, '-')}.bin`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const downloadPdfStrip = useCallback(() => {
    const raw = bytesRef.current
    if (!raw.length) return
    downloadStripPdf({
      bytes: raw,
      patientId: patientId.trim(),
      config: { baudRate, dataBits, parity, stopBits, flowControl, dtr, rts },
    })
  }, [patientId, baudRate, dataBits, parity, stopBits, flowControl, dtr, rts])

  const uploadRaw = useCallback(async () => {
    const raw = bytesRef.current
    if (!patientId.trim()) {
      await Swal.fire({ icon: 'info', title: 'Falta patientId', text: 'Cargá el ID para adjuntar el ECG.' })
      return
    }
    if (!raw.length) return

    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Subir ECG al sistema',
      text: `Se subirá el RAW (${formatBytes(raw.length)}) al paciente ${patientId}.`,
      showCancelButton: true,
      confirmButtonText: 'Subir',
      cancelButtonText: 'Cancelar',
    })
    if (!confirm.isConfirmed) return

    const filename = `ecg_${new Date().toISOString().replace(/[:.]/g, '-')}.bin`
    const res = await uploadECGRaw({
      patientId: patientId.trim(),
      filename,
      mime: 'application/octet-stream',
      bytes: raw,
    })

    if (!res.ok) {
      await Swal.fire({ icon: 'error', title: 'Error subiendo ECG', text: res.error })
      return
    }

    await Swal.fire({
      icon: 'success',
      title: 'ECG subido',
      text: 'Adjunto guardado.',
      timer: 1100,
      showConfirmButton: false,
    })
  }, [patientId])

  /* ====== TX (handshake) ====== */

  const sendENQ = useCallback(async () => {
    if (!session) return
    try {
      await writeBytes(session.port, new Uint8Array([0x05]))
      await Swal.fire({ icon: 'success', title: 'ENQ enviado (0x05)', timer: 900, showConfirmButton: false })
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'No se pudo enviar', text: err instanceof Error ? err.message : String(err) })
    }
  }, [session])

  const sendACK = useCallback(async () => {
    if (!session) return
    try {
      await writeBytes(session.port, new Uint8Array([0x06]))
      await Swal.fire({ icon: 'success', title: 'ACK enviado (0x06)', timer: 900, showConfirmButton: false })
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'No se pudo enviar', text: err instanceof Error ? err.message : String(err) })
    }
  }, [session])

  const sendCustomHex = useCallback(async () => {
    if (!session) return
    const r = await Swal.fire({
      title: 'Enviar HEX',
      input: 'text',
      inputPlaceholder: 'Ej: 05  |  06  |  0D0A  |  0605',
      showCancelButton: true,
      confirmButtonText: 'Enviar',
      cancelButtonText: 'Cancelar',
    })
    if (!r.isConfirmed) return
    const val = typeof r.value === 'string' ? r.value : ''
    if (!val.trim()) return

    try {
      const b = hexToBytes(val)
      if (!b.length) return
      await writeBytes(session.port, b)
      await Swal.fire({ icon: 'success', title: `HEX enviado (${b.length} bytes)`, timer: 900, showConfirmButton: false })
    } catch (err) {
      await Swal.fire({ icon: 'error', title: 'HEX inválido', text: err instanceof Error ? err.message : String(err) })
    }
  }, [session])

  useEffect(() => {
    return () => {
      // cierre fuerte al salir de la screen
      if (session) {
        captureAbortRef.current = true
        session.close().catch(() => void 0)
      }
    }
  }, [session])

  return (
    <div className="ecg-capture">
      <div className="ecg-capture__header">
        <div>
          <h1 className="ecg-capture__title">Captura ECG (RG-401) por RS-232</h1>
          <p className="ecg-capture__subtitle">
            Si cambiás configuración: <b>Reset puerto</b> → Conectar → Capturar.
          </p>
        </div>

        <div className="ecg-capture__badges">
          <span className={`ecg-badge ${supported ? 'is-ok' : 'is-bad'}`}>Web Serial: {supported ? 'OK' : 'NO'}</span>
          <span className={`ecg-badge ${state === 'capturing' ? 'is-warn' : 'is-ok'}`}>Estado: {state}</span>
        </div>
      </div>

      <div className="ecg-capture__grid">
        <section className="ecg-card">
          <h2 className="ecg-card__title">Conexión</h2>

          <label className="ecg-field">
            <span>Patient ID (para adjuntar)</span>
            <input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Ej: 1414"
              className="ecg-input"
            />
          </label>

          <div className="ecg-row">
            <label className="ecg-field">
              <span>Baud</span>
              <select value={baudRate} onChange={(e) => setBaudRate(Number(e.target.value))} className="ecg-select" disabled={!!session}>
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
              </select>
            </label>

            <label className="ecg-field">
              <span>Data bits</span>
              <select value={dataBits} onChange={(e) => setDataBits(Number(e.target.value) as 7 | 8)} className="ecg-select" disabled={!!session}>
                <option value={8}>8</option>
                <option value={7}>7</option>
              </select>
            </label>

            <label className="ecg-field">
              <span>Parity</span>
              <select value={parity} onChange={(e) => setParity(e.target.value as 'none' | 'even' | 'odd')} className="ecg-select" disabled={!!session}>
                <option value="none">none</option>
                <option value="even">even</option>
                <option value="odd">odd</option>
              </select>
            </label>

            <label className="ecg-field">
              <span>Stop</span>
              <select value={stopBits} onChange={(e) => setStopBits(Number(e.target.value) as 1 | 2)} className="ecg-select" disabled={!!session}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>

            <label className="ecg-field">
              <span>Flow</span>
              <select value={flowControl} onChange={(e) => setFlowControl(e.target.value as 'none' | 'hardware')} className="ecg-select" disabled={!!session}>
                <option value="none">none</option>
                <option value="hardware">hardware</option>
              </select>
            </label>
          </div>

          <div className="ecg-toggles">
            <label className="ecg-toggle">
              <input type="checkbox" checked={dtr} onChange={(e) => setDtr(e.target.checked)} disabled={!!session} />
              <span>DTR ON</span>
            </label>
            <label className="ecg-toggle">
              <input type="checkbox" checked={rts} onChange={(e) => setRts(e.target.checked)} disabled={!!session} />
              <span>RTS ON</span>
            </label>
          </div>

          <div className="ecg-actions">
            <button className="ecg-btn" onClick={connect} disabled={!canConnect}>
              Conectar
            </button>
            <button className="ecg-btn" onClick={() => disconnectHard()} disabled={!canDisconnect}>
              Desconectar
            </button>
            <button className="ecg-btn" onClick={() => disconnectHard('Reset manual del puerto para reconfigurar.')} disabled={!canDisconnect}>
              Reset puerto
            </button>
          </div>

          <div className="ecg-actions">
            <button className="ecg-btn ecg-btn--primary" onClick={startCapture} disabled={!canStart}>
              Iniciar captura
            </button>
            <button className="ecg-btn ecg-btn--danger" onClick={stopCapture} disabled={!canStop}>
              Detener
            </button>
          </div>

          <div className="ecg-actions">
            <button className="ecg-btn" onClick={downloadRaw} disabled={!bytes.length}>
              Descargar RAW (.bin)
            </button>
            <button className="ecg-btn" onClick={downloadPdfStrip} disabled={!bytes.length}>
              Descargar PDF (tira)
            </button>
            <button className="ecg-btn ecg-btn--primary" onClick={uploadRaw} disabled={!bytes.length}>
              Subir al sistema
            </button>
            <button className="ecg-btn" onClick={clear}>
              Limpiar
            </button>
          </div>

          <div className="ecg-divider" />

          <h3 className="ecg-subtitle">Handshake (TX)</h3>
          <div className="ecg-actions">
            <button className="ecg-btn" onClick={sendENQ} disabled={!session}>
              Enviar ENQ (0x05)
            </button>
            <button className="ecg-btn" onClick={sendACK} disabled={!session}>
              Enviar ACK (0x06)
            </button>
            <button className="ecg-btn" onClick={sendCustomHex} disabled={!session}>
              Enviar HEX…
            </button>
          </div>

          <div className="ecg-meta">
            <div>
              <span className="ecg-meta__label">Bytes:</span> {formatBytes(bytes.length)}
            </div>
            <div>
              <span className="ecg-meta__label">Únicos:</span> {stats.unique || 0}
            </div>
            <div>
              <span className="ecg-meta__label">Último chunk:</span> {lastChunkAt ? new Date(lastChunkAt).toLocaleTimeString() : '-'}
            </div>
          </div>

          <div className="ecg-hint">
            Regla para reconfigurar: <b>Reset puerto</b> → (cambiar config) → <b>Conectar</b>.
          </div>
        </section>

        <section className="ecg-card">
          <h2 className="ecg-card__title">Preview</h2>

          <div className="ecg-mini-stats">
            {stats.top.map((t) => (
              <div key={t.b} className="ecg-mini-stats__item">
                <span className="k">{`0x${t.b.toString(16).padStart(2, '0').toUpperCase()}`}</span>
                <span className="v">{`${(t.p * 100).toFixed(1)}%`}</span>
              </div>
            ))}
          </div>

          <h3 className="ecg-subtitle">ASCII</h3>
          <div className="ecg-console" role="region" aria-label="ECG serial output ascii">
            <pre>{asciiPreview || 'Sin datos todavía…'}</pre>
          </div>

          <h3 className="ecg-subtitle">HEX (primeros 256 bytes)</h3>
          <div className="ecg-console" role="region" aria-label="ECG serial output hex">
            <pre>{hexPreview || 'Sin datos todavía…'}</pre>
          </div>

          {!supported && (
            <div className="ecg-banner ecg-banner--danger">
              Este navegador no soporta Web Serial. Alternativa: bridge local con Node (serialport) y tu web consume por HTTP/WebSocket.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
