import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import Swal from 'sweetalert2'

import { listConsultorios, type ConsultorioTurno } from '@/api/consultoriosApi'
import {
  listCompanies,
  getCompanyPadron,
  type Company as ApiCompany,
  type CompanyPadronPerson,
} from '@/api/companiesApi'

type PortadaEntry = {
  id: string
  apellidoNombre: string
  nroSocio: string | null
  domicilio: string | null
  fechaNacimiento: string | null
  dni: string
  createdAt: string
  updatedAt?: string
}

type CreateOrUpdatePortadaDto = {
  apellidoNombre: string
  nroSocio?: string | null
  domicilio?: string | null
  fechaNacimiento?: string | null
  dni: string
}

type ApiListResponse = PortadaEntry[]
type Company = ApiCompany

type ClinicalEmployee = {
  key: string
  companyId: string
  companyName: string
  companyNroSocio: string | null
  isCompanyActive: boolean
  dni: string
  nombre: string
  nroAfiliado: string | null
  puesto: string | null
  consultorios: ConsultorioTurno[]
  lastTurnoISO: string | null
  portada: PortadaEntry | null
}

type ClinicalCompanyGroup = {
  company: Company
  people: ClinicalEmployee[]
  totalConsultorios: number
  withPortadaCount: number
}

type HistoriaClinicaPdfPayload = {
  personName: string
  dni: string
  nroSocio?: string | null
  domicilio?: string | null
  fechaNacimiento?: string | null
  companyName?: string | null
  nroAfiliado?: string | null
  puesto?: string | null
  consultorios: ConsultorioTurno[]
}

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:4000'
const API_BASE = RAW_BASE.replace(/\/+$/, '')

function devHeaders(): Record<string, string> {
  if (!import.meta.env.DEV) return {}
  const id = localStorage.getItem('dev_user_id') || ''
  if (!id.trim()) return {}
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

function normalizeDni(value: string | null | undefined) {
  return (value || '').replace(/\D/g, '')
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

function safeFilePart(text: string) {
  return (text || 'archivo')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w-]/g, '')
    .slice(0, 60)
}

function sortAlpha(a: PortadaEntry, b: PortadaEntry) {
  const aa = normalizeText(a.apellidoNombre)
  const bb = normalizeText(b.apellidoNombre)
  if (aa < bb) return -1
  if (aa > bb) return 1
  return a.createdAt < b.createdAt ? -1 : 1
}

function sortCompanies(a: Company, b: Company) {
  if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
  const aa = normalizeText(a.nombre)
  const bb = normalizeText(b.nombre)
  if (aa < bb) return -1
  if (aa > bb) return 1
  return a.createdAt < b.createdAt ? -1 : 1
}

function sortConsultoriosDesc(a: ConsultorioTurno, b: ConsultorioTurno) {
  const byDate = (b.fechaTurnoISO || '').localeCompare(a.fechaTurnoISO || '')
  if (byDate !== 0) return byDate
  return (b.createdAt || '').localeCompare(a.createdAt || '')
}

function dedupePadronPeople(items: CompanyPadronPerson[]) {
  const map = new Map<string, CompanyPadronPerson>()

  items.forEach((item) => {
    const dni = normalizeDni(item.dni)
    if (!dni) return
    if (!map.has(dni)) {
      map.set(dni, item)
      return
    }

    const prev = map.get(dni)
    if (!prev) {
      map.set(dni, item)
      return
    }

    const prevScore = `${prev.nombre || ''}${prev.puesto || ''}${prev.nroAfiliado || ''}`.length
    const nextScore = `${item.nombre || ''}${item.puesto || ''}${item.nroAfiliado || ''}`.length
    if (nextScore > prevScore) map.set(dni, item)
  })

  return Array.from(map.values()).sort((a, b) =>
    normalizeText(a.nombre || '').localeCompare(normalizeText(b.nombre || '')),
  )
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[]
  let index = 0
  const total = Math.max(1, Math.floor(limit))

  const runners = new Array(Math.min(total, items.length)).fill(0).map(async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current])
    }
  })

  await Promise.all(runners)
  return results
}

function pickNewestPortada(a: PortadaEntry | undefined, b: PortadaEntry) {
  if (!a) return b
  const aDate = a.updatedAt || a.createdAt || ''
  const bDate = b.updatedAt || b.createdAt || ''
  return bDate.localeCompare(aDate) > 0 ? b : a
}

function buildHistoriaClinicaPdf(payload: HistoriaClinicaPdfPayload) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentW = pageW - margin * 2
  const sortedConsultorios = payload.consultorios.slice().sort(sortConsultoriosDesc)
  let y = margin

  const ensureSpace = (need: number, withHeader = false) => {
    if (y + need <= pageH - margin) return
    doc.addPage()
    y = margin
    if (withHeader) drawHistoryTableHead()
  }

  const drawLabelValue = (label: string, value: string, x: number, top: number, width: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(label, x, top)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(value || '—', width)
    doc.text(lines, x, top + 5)
    return lines.length * 4.5 + 7
  }

  const drawHistoryTableHead = () => {
    doc.setFillColor(245, 247, 250)
    doc.roundedRect(margin, y, contentW, 9, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.2)
    doc.text('Fecha', margin + 3, y + 5.8)
    doc.text('Empresa', margin + 28, y + 5.8)
    doc.text('Diagnóstico', margin + 88, y + 5.8)
    y += 12
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('HISTORIA CLÍNICA', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(fmtDate(new Date()), pageW - margin, y + 6, { align: 'right' })

  doc.setDrawColor(210)
  doc.line(margin, y + 10, pageW - margin, y + 10)
  y += 16

  const boxX = pageW - margin - 54
  doc.setDrawColor(0)
  doc.rect(boxX, y - 8, 54, 17)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('N° SOCIO', boxX + 27, y - 2.2, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(payload.nroSocio?.trim() || '—', boxX + 27, y + 4.6, { align: 'center' })

  doc.rect(boxX, y + 9, 54, 17)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('DNI', boxX + 27, y + 14.8, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(payload.dni?.trim() || '—', boxX + 27, y + 21.4, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  const personLines = doc.splitTextToSize((payload.personName || ' ').toUpperCase(), contentW - 60)
  doc.text(personLines, margin, y)
  y += personLines.length * 5 + 2

  const leftW = 98
  const rightX = margin + leftW + 8
  const rightW = pageW - margin - rightX

  const row1 = Math.max(
    drawLabelValue('DOMICILIO', payload.domicilio?.trim() || '—', margin, y, leftW),
    drawLabelValue('EMPRESA', payload.companyName?.trim() || '—', rightX, y, rightW),
  )
  y += row1

  const row2 = Math.max(
    drawLabelValue('FECHA DE NAC.', fmtFechaNacimiento(payload.fechaNacimiento || '') || '—', margin, y, leftW),
    drawLabelValue('N° AFILIADO', payload.nroAfiliado?.trim() || '—', rightX, y, rightW),
  )
  y += row2

  const row3 = drawLabelValue('PUESTO', payload.puesto?.trim() || '—', margin, y, contentW)
  y += row3 + 2

  doc.setFillColor(247, 250, 249)
  doc.setDrawColor(217, 227, 223)
  doc.roundedRect(margin, y, contentW, 28, 3, 3, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Resumen del historial', margin + 4, y + 6)

  const latest = sortedConsultorios[0] || null
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`Consultas registradas: ${sortedConsultorios.length}`, margin + 4, y + 12)
  doc.text(
    `Última atención: ${latest?.fechaTurnoISO ? fmtFechaNacimiento(latest.fechaTurnoISO) : '—'}`,
    margin + 4,
    y + 17,
  )

  const diagPreview = latest?.diagnostico?.trim() || 'Sin observaciones registradas todavía.'
  const diagLines = doc.splitTextToSize(`Último diagnóstico: ${diagPreview}`, contentW - 8)
  doc.text(diagLines.slice(0, 2), margin + 4, y + 22)
  y += 36

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Historial de consultorio', margin, y)
  y += 6

  if (!sortedConsultorios.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('No hay atenciones de consultorio cargadas para esta persona.', margin, y)
  } else {
    ensureSpace(18)
    drawHistoryTableHead()

    const fechaW = 22
    const empresaW = 56
    const diagX = margin + fechaW + empresaW + 14
    const diagW = pageW - margin - diagX
    const rowLineH = 4.2

    sortedConsultorios.forEach((turno) => {
      const fecha = turno.fechaTurnoISO ? fmtFechaNacimiento(turno.fechaTurnoISO) : '—'
      const empresaLines = doc.splitTextToSize(turno.empresaNombre || '—', empresaW)
      const diagLines = doc.splitTextToSize(turno.diagnostico || '—', diagW)
      const maxLines = Math.max(empresaLines.length, diagLines.length, 1)
      const rowH = maxLines * rowLineH + 4

      ensureSpace(rowH + 6, true)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.2)
      doc.text(fecha, margin + 3, y)
      doc.text(empresaLines, margin + 28, y)
      doc.text(diagLines, diagX, y)

      y += rowH
      doc.setDrawColor(228)
      doc.line(margin, y, pageW - margin, y)
      y += 4
    })
  }

  doc.setDrawColor(210)
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.6)
  doc.setTextColor(110)
  doc.text('Medic Laboral - Historia clínica integrada', margin, pageH - 8)

  return doc
}

export default function PortadaScreen() {
  const [items, setItems] = useState<PortadaEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [clinicalLoading, setClinicalLoading] = useState(false)

  const [q, setQ] = useState('')
  const [clinicalQ, setClinicalQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedClinicalKey, setSelectedClinicalKey] = useState<string | null>(null)
  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null)

  const [apellidoNombre, setApellidoNombre] = useState('')
  const [nroSocio, setNroSocio] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [dni, setDni] = useState('')

  const [companies, setCompanies] = useState<Company[]>([])
  const [consultorios, setConsultorios] = useState<ConsultorioTurno[]>([])
  const [padronByCompanyId, setPadronByCompanyId] = useState<Map<string, CompanyPadronPerson[]>>(() => new Map())

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) || null,
    [items, selectedId],
  )

  const consultoriosByDni = useMemo(() => {
    const map = new Map<string, ConsultorioTurno[]>()
    consultorios.forEach((turno) => {
      const key = normalizeDni(turno.dni)
      if (!key) return
      const list = map.get(key) || []
      list.push(turno)
      map.set(key, list)
    })

    map.forEach((value, key) => {
      map.set(key, value.slice().sort(sortConsultoriosDesc))
    })

    return map
  }, [consultorios])

  const groupedClinical = useMemo<ClinicalCompanyGroup[]>(() => {
    const latestPortadaByDni = new Map<string, PortadaEntry>()
    items.forEach((item) => {
      const dniKey = normalizeDni(item.dni)
      if (!dniKey) return
      latestPortadaByDni.set(dniKey, pickNewestPortada(latestPortadaByDni.get(dniKey), item))
    })

    const query = normalizeText(clinicalQ)

    return companies
      .map((company) => {
        const peopleMap = new Map<string, ClinicalEmployee>()
        const padron = padronByCompanyId.get(company.id) || []

        padron.forEach((person) => {
          const dniKey = normalizeDni(person.dni)
          if (!dniKey) return
          peopleMap.set(dniKey, {
            key: `${company.id}::${dniKey}`,
            companyId: company.id,
            companyName: company.nombre,
            companyNroSocio: company.nroSocio ?? null,
            isCompanyActive: company.isActive,
            dni: dniKey,
            nombre: (person.nombre || '').trim() || 'Sin nombre',
            nroAfiliado: person.nroAfiliado ?? null,
            puesto: person.puesto ?? null,
            consultorios: [],
            lastTurnoISO: person.lastTurnoISO ?? null,
            portada: latestPortadaByDni.get(dniKey) || null,
          })
        })

        consultorios
          .filter((turno) => turno.empresaId === company.id)
          .forEach((turno) => {
            const dniKey = normalizeDni(turno.dni)
            if (!dniKey) return

            const prev = peopleMap.get(dniKey)
            if (prev) {
              prev.consultorios.push(turno)
              prev.lastTurnoISO = turno.fechaTurnoISO || prev.lastTurnoISO
              if (!prev.nombre.trim()) prev.nombre = turno.nombre || 'Sin nombre'
              return
            }

            peopleMap.set(dniKey, {
              key: `${company.id}::${dniKey}`,
              companyId: company.id,
              companyName: company.nombre,
              companyNroSocio: company.nroSocio ?? null,
              isCompanyActive: company.isActive,
              dni: dniKey,
              nombre: (turno.nombre || '').trim() || 'Sin nombre',
              nroAfiliado: null,
              puesto: null,
              consultorios: [turno],
              lastTurnoISO: turno.fechaTurnoISO || null,
              portada: latestPortadaByDni.get(dniKey) || null,
            })
          })

        const people = Array.from(peopleMap.values())
          .map((person) => ({
            ...person,
            consultorios: person.consultorios.slice().sort(sortConsultoriosDesc),
            lastTurnoISO:
              person.consultorios[0]?.fechaTurnoISO || person.lastTurnoISO || null,
            portada: latestPortadaByDni.get(person.dni) || person.portada || null,
          }))
          .sort((a, b) => normalizeText(a.nombre).localeCompare(normalizeText(b.nombre)))

        const matchesCompany = query ? normalizeText(company.nombre).includes(query) : true
        const filteredPeople = query
          ? matchesCompany
            ? people
            : people.filter((person) => {
                const hay =
                  normalizeText(person.nombre) +
                  ' ' +
                  normalizeText(person.dni) +
                  ' ' +
                  normalizeText(person.nroAfiliado || '') +
                  ' ' +
                  normalizeText(person.puesto || '')
                return hay.includes(query)
              })
          : people

        return {
          company,
          people: filteredPeople,
          totalConsultorios: filteredPeople.reduce((acc, person) => acc + person.consultorios.length, 0),
          withPortadaCount: filteredPeople.filter((person) => person.portada).length,
        }
      })
      .filter((group) => group.people.length > 0)
  }, [clinicalQ, companies, consultorios, items, padronByCompanyId])

  const selectedClinicalPerson = useMemo(() => {
    if (!selectedClinicalKey) return null
    for (const group of groupedClinical) {
      const hit = group.people.find((person) => person.key === selectedClinicalKey)
      if (hit) return hit
    }
    return null
  }, [groupedClinical, selectedClinicalKey])

  const standaloneSelectedConsultorios = useMemo(() => {
    if (!selected) return []
    return consultoriosByDni.get(normalizeDni(selected.dni)) || []
  }, [consultoriosByDni, selected])

  const pdfPayload = useMemo<HistoriaClinicaPdfPayload | null>(() => {
    if (selectedClinicalPerson) {
      const firstNacimiento = selectedClinicalPerson.consultorios.find((c) => c.nacimientoISO)?.nacimientoISO || null
      return {
        personName: selectedClinicalPerson.portada?.apellidoNombre || selectedClinicalPerson.nombre,
        dni: selectedClinicalPerson.dni,
        nroSocio: selectedClinicalPerson.portada?.nroSocio || selectedClinicalPerson.companyNroSocio || null,
        domicilio: selectedClinicalPerson.portada?.domicilio || null,
        fechaNacimiento: selectedClinicalPerson.portada?.fechaNacimiento || firstNacimiento,
        companyName: selectedClinicalPerson.companyName,
        nroAfiliado: selectedClinicalPerson.nroAfiliado,
        puesto: selectedClinicalPerson.puesto,
        consultorios: selectedClinicalPerson.consultorios,
      }
    }

    if (!selected) return null

    const ownConsultorios = standaloneSelectedConsultorios
    return {
      personName: selected.apellidoNombre,
      dni: selected.dni,
      nroSocio: selected.nroSocio,
      domicilio: selected.domicilio,
      fechaNacimiento: selected.fechaNacimiento,
      companyName: ownConsultorios[0]?.empresaNombre || null,
      nroAfiliado: null,
      puesto: null,
      consultorios: ownConsultorios,
    }
  }, [selectedClinicalPerson, selected, standaloneSelectedConsultorios])

  const activeCompanySummary = useMemo(() => {
    const totalCompanies = groupedClinical.length
    const totalEmployees = groupedClinical.reduce((acc, group) => acc + group.people.length, 0)
    const totalHistories = groupedClinical.reduce((acc, group) => acc + group.totalConsultorios, 0)
    return { totalCompanies, totalEmployees, totalHistories }
  }, [groupedClinical])

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

  const loadClinicalData = useCallback(async () => {
    setClinicalLoading(true)

    try {
      const [companiesRes, consultoriosRes] = await Promise.all([
        listCompanies({ q: '' }),
        listConsultorios({ take: 5000 }),
      ])

      const nextCompanies = (companiesRes.items || []).slice().sort(sortCompanies)
      setCompanies(nextCompanies)
      setConsultorios((consultoriosRes || []).slice().sort(sortConsultoriosDesc))

      const padronEntries = await runWithConcurrency(
  nextCompanies,
  4,
  async (company): Promise<[string, CompanyPadronPerson[]]> => {
    try {
      const r = await getCompanyPadron(company.id)
      return [company.id, dedupePadronPeople(r.items || [])]
    } catch {
      return [company.id, []]
    }
  },
)

setPadronByCompanyId(new Map<string, CompanyPadronPerson[]>(padronEntries))

      setPadronByCompanyId(new Map(padronEntries))
      setOpenCompanyId((prev) => prev || nextCompanies[0]?.id || null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo cargar el historial clínico integrado.'
      Swal.fire({ icon: 'error', title: 'Error', text: msg })
    } finally {
      setClinicalLoading(false)
    }
  }, [])

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

    void loadClinicalData()

    return () => {
      alive = false
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [loadClinicalData])

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
    const docId = normalizeDni(dni)

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

      if (selectedClinicalKey) {
        Swal.fire({
          icon: 'success',
          title: 'Portada vinculada',
          text: 'Se guardó la portada y quedó integrada al historial clínico.',
          timer: 1600,
          showConfirmButton: false,
        })
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Guardado',
          text: 'Se guardó la portada.',
          timer: 1400,
          showConfirmButton: false,
        })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      Swal.fire({ icon: 'error', title: 'Error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  function handlePreview() {
    if (!pdfPayload) return
    setPreviewOpen((prev) => {
      const next = !prev
      if (next) {
        const doc = buildHistoriaClinicaPdf(pdfPayload)
        setPdfPreview(doc)
      } else {
        closePreview()
      }
      return next
    })
  }

  function handleDownload() {
    if (!pdfPayload) return
    const doc = buildHistoriaClinicaPdf(pdfPayload)
    const namePart = safeFilePart(pdfPayload.personName || 'historia_clinica')
    const companyPart = safeFilePart(pdfPayload.companyName || 'sin_empresa')
    doc.save(`Historia_Clinica_${namePart}_${companyPart}_${new Date().toISOString().slice(0, 10)}.pdf`)
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

  function handleSelectClinicalPerson(person: ClinicalEmployee) {
    setSelectedClinicalKey(person.key)
    setOpenCompanyId(person.companyId)

    if (person.portada) {
      setSelectedId(person.portada.id)
      return
    }

    const nacimientoFromHistory = person.consultorios.find((entry) => entry.nacimientoISO)?.nacimientoISO || ''

    setSelectedId(null)
    setApellidoNombre(person.nombre)
    setDni(person.dni)
    setNroSocio(person.companyNroSocio || person.nroAfiliado || '')
    setFechaNacimiento(nacimientoFromHistory)

    Swal.fire({
      icon: 'info',
      title: 'Empleado sin portada',
      text: 'Te dejé los datos básicos cargados arriba para que puedas guardar la portada y unirla al historial.',
      timer: 2300,
      showConfirmButton: false,
    })
  }

  useEffect(() => {
    if (!previewOpen || !pdfPayload) return
    const t = window.setTimeout(() => {
      const doc = buildHistoriaClinicaPdf(pdfPayload)
      setPdfPreview(doc)
    }, 180)
    return () => window.clearTimeout(t)
  }, [pdfPayload, previewOpen])


  useEffect(() => {
    if (!groupedClinical.length) return
    if (openCompanyId && groupedClinical.some((group) => group.company.id === openCompanyId)) return
    setOpenCompanyId(groupedClinical[0].company.id)
  }, [groupedClinical, openCompanyId])

  useEffect(() => {
    if (!selectedClinicalKey) return
    const exists = groupedClinical.some((group) =>
      group.people.some((person) => person.key === selectedClinicalKey),
    )
    if (!exists) setSelectedClinicalKey(null)
  }, [groupedClinical, selectedClinicalKey])

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
            <button className="btn btn--outline" type="button" onClick={handlePreview} disabled={!pdfPayload}>
              {previewOpen ? 'Cerrar previsualización' : 'Previsualizar PDF'}
            </button>
            <button className="btn btn--primary" type="button" onClick={handleDownload} disabled={!pdfPayload}>
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
              const active = p.id === selectedId && !selectedClinicalKey
              const consultCount = consultoriosByDni.get(normalizeDni(p.dni))?.length || 0

              return (
                <button
                  key={p.id}
                  type="button"
                  className={'portada-item' + (active ? ' portada-item--active' : '')}
                  onClick={() => {
                    setSelectedClinicalKey(null)
                    setSelectedId(p.id)
                  }}
                >
                  <div className="portada-item__main">
                    <div className="portada-item__name">{p.apellidoNombre}</div>
                    <div className="portada-item__meta">
                      <span className="chip">Socio: {p.nroSocio || '-'}</span>
                      <span className="chip">DNI: {p.dni || '-'}</span>
                      <span className="chip">Nac: {p.fechaNacimiento ? fmtFechaNacimiento(p.fechaNacimiento) : '-'}</span>
                      <span className="chip chip--soft">Consultorios: {consultCount}</span>
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

      <div className="card portada__card portada__clinical-card">
        <div className="portada__clinical-head">
          <div>
            <h3 className="portada__section-title">Historial clínico integrado</h3>
            <p className="portada__section-sub">Consultorios agrupados por empresa. Al elegir un empleado, la descarga une la portada con su historial de consultorio.</p>
          </div>

          <div className="portada__actions">
            <button className="btn btn--outline" type="button" onClick={() => void loadClinicalData()} disabled={clinicalLoading}>
              {clinicalLoading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </div>

        <div className="portada__clinical-toolbar">
          <input
            className="input"
            placeholder="Buscar empresa, empleado, DNI, afiliado o puesto…"
            value={clinicalQ}
            onChange={(e) => setClinicalQ(e.target.value)}
          />

          <div className="portada__summary-chips">
            <span className="chip">Empresas: {activeCompanySummary.totalCompanies}</span>
            <span className="chip">Empleados: {activeCompanySummary.totalEmployees}</span>
            <span className="chip">Consultorios: {activeCompanySummary.totalHistories}</span>
          </div>
        </div>

        {clinicalLoading && groupedClinical.length === 0 ? (
          <div className="portada__empty">Cargando historial clínico integrado…</div>
        ) : groupedClinical.length === 0 ? (
          <div className="portada__empty">No hay empresas o empleados con historial clínico para mostrar.</div>
        ) : (
          <div className="portada__clinical-layout">
            <div className="portada__company-list">
              {groupedClinical.map((group) => {
                const isOpen = openCompanyId === group.company.id
                return (
                  <div key={group.company.id} className={'company-block' + (isOpen ? ' company-block--open' : '')}>
                    <button
                      type="button"
                      className="company-block__head"
                      onClick={() => setOpenCompanyId((prev) => (prev === group.company.id ? null : group.company.id))}
                    >
                      <div className="company-block__title-wrap">
                        <div className="company-block__title">{group.company.nombre}</div>
                        <div className="company-block__meta">
                          <span className="chip">Empleados: {group.people.length}</span>
                          <span className="chip">Consultorios: {group.totalConsultorios}</span>
                          <span className="chip">Con portada: {group.withPortadaCount}</span>
                          {!group.company.isActive && <span className="chip chip--danger">Baja</span>}
                        </div>
                      </div>
                      <span className="company-block__toggle">{isOpen ? '−' : '+'}</span>
                    </button>

                    {isOpen && (
                      <div className="company-block__body">
                        {group.people.map((person) => {
                          const active = selectedClinicalKey === person.key
                          return (
                            <button
                              key={person.key}
                              type="button"
                              className={'employee-card' + (active ? ' employee-card--active' : '')}
                              onClick={() => handleSelectClinicalPerson(person)}
                            >
                              <div className="employee-card__name">{person.portada?.apellidoNombre || person.nombre}</div>
                              <div className="employee-card__meta">
                                <span className="chip">DNI: {person.dni}</span>
                                <span className="chip">Afiliado: {person.nroAfiliado || '—'}</span>
                                <span className="chip">Puesto: {person.puesto || '—'}</span>
                                <span className="chip chip--soft">Consultorios: {person.consultorios.length}</span>
                                <span className={'chip ' + (person.portada ? 'chip--success' : 'chip--warning')}>
                                  {person.portada ? 'Con portada' : 'Sin portada'}
                                </span>
                              </div>
                              <div className="employee-card__foot">
                                <span>Último consultorio: {person.lastTurnoISO ? fmtFechaNacimiento(person.lastTurnoISO) : '—'}</span>
                                <span>{person.consultorios[0]?.diagnostico || 'Sin diagnóstico cargado'}</span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="portada__detail-panel">
              {selectedClinicalPerson ? (
                <>
                  <div className="detail-panel__head">
                    <div>
                      <h4 className="detail-panel__title">{selectedClinicalPerson.portada?.apellidoNombre || selectedClinicalPerson.nombre}</h4>
                      <p className="detail-panel__sub">{selectedClinicalPerson.companyName}</p>
                    </div>
                    <div className="detail-panel__actions">
                      <button className="btn btn--outline btn--sm" type="button" onClick={handlePreview}>
                        Previsualizar
                      </button>
                      <button className="btn btn--primary btn--sm" type="button" onClick={handleDownload}>
                        Descargar PDF
                      </button>
                    </div>
                  </div>

                  <div className="detail-panel__chips">
                    <span className="chip">DNI: {selectedClinicalPerson.dni}</span>
                    <span className="chip">Afiliado: {selectedClinicalPerson.nroAfiliado || '—'}</span>
                    <span className="chip">Puesto: {selectedClinicalPerson.puesto || '—'}</span>
                    <span className="chip">Consultorios: {selectedClinicalPerson.consultorios.length}</span>
                    <span className={'chip ' + (selectedClinicalPerson.portada ? 'chip--success' : 'chip--warning')}>
                      {selectedClinicalPerson.portada ? 'Portada vinculada' : 'Falta portada'}
                    </span>
                  </div>

                  {!selectedClinicalPerson.portada && (
                    <div className="detail-panel__notice">
                      Este empleado todavía no tiene portada guardada. Podés usar los datos autocompletados arriba, guardar la portada y luego descargar el PDF integrado completo.
                    </div>
                  )}

                  <div className="detail-panel__table-wrap">
                    <table className="detail-panel__table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Empresa</th>
                          <th>Diagnóstico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClinicalPerson.consultorios.length > 0 ? (
                          selectedClinicalPerson.consultorios.map((turno) => (
                            <tr key={turno.id}>
                              <td>{turno.fechaTurnoISO ? fmtFechaNacimiento(turno.fechaTurnoISO) : '—'}</td>
                              <td>{turno.empresaNombre || '—'}</td>
                              <td>{turno.diagnostico || '—'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3} className="detail-panel__empty-row">
                              No hay consultorios cargados para esta persona.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : pdfPayload ? (
                <div className="detail-panel__placeholder">
                  <h4 className="detail-panel__title">{pdfPayload.personName}</h4>
                  <p className="detail-panel__sub">Seleccionado desde el historial general de portadas.</p>
                  <div className="detail-panel__chips">
                    <span className="chip">DNI: {pdfPayload.dni}</span>
                    <span className="chip">Consultorios: {pdfPayload.consultorios.length}</span>
                    <span className="chip">Empresa: {pdfPayload.companyName || '—'}</span>
                  </div>
                  <div className="detail-panel__notice">
                    La previsualización y la descarga ya incluyen automáticamente el historial de consultorio asociado al DNI seleccionado.
                  </div>
                </div>
              ) : (
                <div className="detail-panel__placeholder">
                  Seleccioná una portada o un empleado dentro de una empresa para ver el historial clínico integrado y descargarlo en PDF.
                </div>
              )}
            </div>
          </div>
        )}
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
