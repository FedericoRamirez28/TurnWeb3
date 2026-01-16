import React, { useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'

type PortadaEntry = {
  id: string
  apellidoNombre: string
  nroSocio: string | null
  domicilio: string | null
  fechaNacimiento: string | null // YYYY-MM-DD
  dni: string
  createdAt: string // ISO
  updatedAt?: string // ISO
}

type CreateOrUpdatePortadaDto = {
  apellidoNombre: string
  nroSocio?: string | null
  domicilio?: string | null
  fechaNacimiento?: string | null
  dni: string
}

type ApiListResponse = PortadaEntry[]

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:4000'
const API_BASE = RAW_BASE.replace(/\/+$/, '')

function devHeaders(): Record<string, string> {
  if (!import.meta.env.DEV) return {}
  const id = localStorage.getItem('dev_user_id') || ''
  if (!id.trim()) return {} // que el backend te devuelva 401 claro
  return { 'x-user-id': id.trim() }
}


async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...devHeaders(),
      ...(init?.headers ?? {}),
    },
  })

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  const data: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '')

  if (!res.ok) {
    const obj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
    const msg =
      (obj && typeof obj.message === 'string' && obj.message) ||
      (obj && typeof obj.error === 'string' && obj.error) ||
      (typeof data === 'string' && data) ||
      `HTTP ${res.status}`
    throw new Error(msg)
  }

  return data as T
}

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function sortAlpha(a: PortadaEntry, b: PortadaEntry) {
  const aa = normalizeText(a.apellidoNombre)
  const bb = normalizeText(b.apellidoNombre)
  if (aa < bb) return -1
  if (aa > bb) return 1
  return a.createdAt < b.createdAt ? -1 : 1
}

function fmtDate(d = new Date()) {
  return d.toLocaleDateString()
}

function fmtFechaNacimiento(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function buildPortadaPdf(p: PortadaEntry) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  doc.setDrawColor(120)
  

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text((p.apellidoNombre || ' ').toUpperCase(), margin, 10)

  const boxX = pageW - margin - 50
  const boxY = 4
  doc.setDrawColor(0)
  doc.rect(boxX, boxY, 62, 18)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('N° SOCIO', boxX + 31, boxY + 7, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.text(p.nroSocio || ' ', boxX + 31, boxY + 14, { align: 'center' })

  doc.rect(boxX, boxY + 18, 62, 14)
  doc.setFont('helvetica', 'bold')
  doc.text('DNI', boxX + 31, boxY + 23, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.text(p.dni || ' ', boxX + 31, boxY + 30, { align: 'center' })

  const y0 = 16
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('DOMICILIO:', margin, y0)
  doc.setFont('helvetica', 'normal')
  doc.text(p.domicilio || ' ', margin + 40, y0)

  doc.setFont('helvetica', 'bold')
  doc.text('FECHA DE NAC.:', margin, y0 + 9)
  doc.setFont('helvetica', 'normal')
  doc.text(fmtFechaNacimiento(p.fechaNacimiento || '') || ' ', margin + 40, y0 + 9)

  doc.setDrawColor(200)
  doc.line(margin, 285, pageW - margin, 285)
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text('Medic Laboral - Historia Clínica (Portada)', margin, 292)

  return doc
}

export default function PortadaScreen() {
  const [items, setItems] = useState<PortadaEntry[]>([])
  const [loading, setLoading] = useState(false)

  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [apellidoNombre, setApellidoNombre] = useState('')
  const [nroSocio, setNroSocio] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [dni, setDni] = useState('')

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId],
  )

  async function refreshList(query: string) {
    const qq = query.trim()
    const path = `/laboral/portadas?take=500${qq ? `&q=${encodeURIComponent(qq)}` : ''}`
    const data = await api<ApiListResponse>(path)
    const sorted = data.slice().sort(sortAlpha)

    setItems(sorted)
    setSelectedId((prev) => {
      if (!sorted.length) return null
      if (!prev) return sorted[0].id
      if (!sorted.some((x) => x.id === prev)) return sorted[0].id
      return prev
    })
  }

  useEffect(() => {
    let alive = true
    setLoading(true)

    refreshList('')
      .catch((e) => {
        if (!alive) return
        const msg = e instanceof Error ? e.message : 'No se pudo cargar Portadas.'
        Swal.fire({ icon: 'error', title: 'Error', text: msg })
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      setLoading(true)
      refreshList(q).catch(() => {}).finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(t)
  }, [q])

  const filtered = useMemo(() => {
    const qq = normalizeText(q)
    if (!qq) return items
    return items.filter((p) => {
      const hay =
        normalizeText(p.apellidoNombre) +
        ' ' +
        normalizeText(p.dni) +
        ' ' +
        normalizeText(p.nroSocio || '') +
        ' ' +
        normalizeText(p.domicilio || '')
      return hay.includes(qq)
    })
  }, [items, q])

  function clearForm() {
    setApellidoNombre('')
    setNroSocio('')
    setDomicilio('')
    setFechaNacimiento('')
    setDni('')
  }

  function closePreview() {
    setPreviewOpen(false)
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setPreviewUrl(null)
  }

  function setPdfPreview(doc: jsPDF) {
    try {
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = url
      setPreviewUrl(url)
    } catch {
      const dataUri = doc.output('datauristring')
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      setPreviewUrl(dataUri)
    }
  }

  async function handleSave() {
    const name = apellidoNombre.trim()
    const docId = dni.trim()

    if (!name || !docId) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completá Apellido y nombre + DNI.',
      })
      return
    }

    const dto: CreateOrUpdatePortadaDto = {
      apellidoNombre: name,
      dni: docId,
      nroSocio: nroSocio.trim() || null,
      domicilio: domicilio.trim() || null,
      fechaNacimiento: fechaNacimiento || null,
    }

    try {
      setLoading(true)
      const saved = await api<PortadaEntry>(`/laboral/portadas`, {
        method: 'POST',
        body: JSON.stringify(dto),
      })

      await refreshList(q)
      setSelectedId(saved.id)
      clearForm()

      Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: 'Se guardó la portada.',
        timer: 1400,
        showConfirmButton: false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'Error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  function handlePreview() {
    if (!selected) return
    setPreviewOpen((prev) => {
      const next = !prev
      if (next) {
        const doc = buildPortadaPdf(selected)
        setPdfPreview(doc)
      } else {
        closePreview()
      }
      return next
    })
  }

  function handleDownload() {
    if (!selected) return
    const doc = buildPortadaPdf(selected)
    const safeName =
      (selected.apellidoNombre || 'portada')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^\w-]/g, '')
        .slice(0, 40) || 'portada'
    doc.save(`Portada_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  async function handleDeleteSelected() {
    if (!selected) return

    const ok = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar?',
      text: `Se eliminará la portada de ${selected.apellidoNombre}.`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
    })

    if (!ok.isConfirmed) return

    try {
      setLoading(true)
      await api<void>(`/laboral/portadas/${selected.id}`, { method: 'DELETE' })
      await refreshList(q)
      Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1200, showConfirmButton: false })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'Error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!previewOpen || !selected) return
    const t = window.setTimeout(() => {
      const doc = buildPortadaPdf(selected)
      setPdfPreview(doc)
    }, 180)
    return () => window.clearTimeout(t)
  }, [previewOpen, selected])

  return (
    <div className="portada">
      <div className="card portada__card">
        <div className="portada__header">
          <div>
            <h2 className="portada__title">Historia clínica</h2>
            <p className="portada__subtitle">Portada</p>
          </div>
          <span className="portada__date">{fmtDate(new Date())}</span>
        </div>

        <div className="portada__body">
          <div className="portada__row portada__row--two">
            <label className="portada__label">
              Apellido y nombre
              <input className="input" value={apellidoNombre} onChange={(e) => setApellidoNombre(e.target.value)} />
            </label>

            <label className="portada__label">
              N° de socio
              <input className="input" value={nroSocio} onChange={(e) => setNroSocio(e.target.value)} />
            </label>
          </div>

          <div className="portada__row">
            <label className="portada__label">
              Domicilio
              <input className="input" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
            </label>
          </div>

          <div className="portada__row portada__row--two">
            <label className="portada__label">
              Fecha de nacimiento
              <input className="input" type="date" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} />
            </label>

            <label className="portada__label">
              DNI
              <input className="input" value={dni} onChange={(e) => setDni(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="portada__footer">
          <button className="btn btn--primary" type="button" onClick={handleSave} disabled={!apellidoNombre.trim() || !dni.trim() || loading}>
            {loading ? 'Guardando…' : 'Guardar información'}
          </button>
        </div>
      </div>

      <div className="card portada__card">
        <div className="portada__hist-head">
          <div>
            <h3 className="portada__section-title">Historial</h3>
            <p className="portada__section-sub">Orden alfabético + búsqueda inteligente</p>
          </div>

          <div className="portada__actions">
            <button className="btn btn--outline" type="button" onClick={handlePreview} disabled={!selected}>
              {previewOpen ? 'Cerrar previsualización' : 'Previsualizar'}
            </button>
            <button className="btn btn--primary" type="button" onClick={handleDownload} disabled={!selected}>
              Descargar PDF
            </button>
            <button className="btn btn--outline" type="button" onClick={handleDeleteSelected} disabled={!selected || loading}>
              Eliminar
            </button>
          </div>
        </div>

        <div className="portada__search">
          <input className="input" placeholder="Buscar por nombre, apellido, DNI o N° socio…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="portada__list">
          {loading && items.length === 0 ? (
            <div className="portada__empty">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="portada__empty">No hay resultados.</div>
          ) : (
            filtered.map((p) => {
              const active = p.id === selectedId
              return (
                <button
                  key={p.id}
                  type="button"
                  className={'portada-item' + (active ? ' portada-item--active' : '')}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="portada-item__main">
                    <div className="portada-item__name">{p.apellidoNombre}</div>
                    <div className="portada-item__meta">
                      <span className="chip">Socio: {p.nroSocio || '-'}</span>
                      <span className="chip">DNI: {p.dni || '-'}</span>
                      <span className="chip">Nac: {p.fechaNacimiento ? fmtFechaNacimiento(p.fechaNacimiento) : '-'}</span>
                    </div>
                  </div>

                  <div className="portada-item__side">
                    <div className="portada-item__addr">{p.domicilio || '-'}</div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {previewOpen && (
        <div className="portada-preview-wrap">
          <div className="card portada__preview">
            <div className="portada__preview-head">
              <span className="portada__preview-title">Previsualización</span>
              <button className="btn btn--ghost btn--sm" type="button" onClick={closePreview}>
                Ocultar
              </button>
            </div>

            <div className="portada__preview-frame">
              {previewUrl ? <iframe title="preview" src={previewUrl} /> : <div className="portada__preview-loading">Generando vista previa…</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
