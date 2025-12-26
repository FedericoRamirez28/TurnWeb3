// src/api/turnosApi.ts
import type { Affiliate, Appointment, AppointmentStatus } from '@/components/screens/homeModels'
import type { AffiliateFormValues } from '@/components/ui/home/AffiliateQuicklist'
import { apiJson, getApiBaseUrl } from './http'

const API_BASE_URL = getApiBaseUrl() // fallback interno a http://localhost:4000

function withBase(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${p}`
}

/* ====================================================== AFILIADOS ====================================================== */

type AfiliadoApi = {
  id: string
  numeroAfiliado: string
  dni: string
  nombreCompleto: string
  domicilio?: string | null
  localidad?: string | null
  codigoPostal?: string | null
  partido?: string | null
  provincia?: string | null
  telefono?: string | null
  telefonoAlt?: string | null
  email?: string | null
  fechaNacimiento?: string | null
  esTitular?: boolean | null
  plan?: string | null
  activo?: boolean | null
}

const mapAfiliadoApiToAffiliate = (a: AfiliadoApi): Affiliate => ({
  id: a.id,
  numeroAfiliado: a.numeroAfiliado ?? '',
  nombreCompleto: a.nombreCompleto ?? '',
  dni: a.dni ?? '',
  domicilio: a.domicilio ?? undefined,
  localidad: a.localidad ?? undefined,
  codigoPostal: a.codigoPostal ?? undefined,
  partido: a.partido ?? undefined,
  provincia: a.provincia ?? undefined,
  telefono: a.telefono ?? undefined,
  telefonoAlt: a.telefonoAlt ?? undefined,
  email: a.email ?? undefined,
  fechaNacimiento: a.fechaNacimiento ?? undefined,
  esTitular: typeof a.esTitular === 'boolean' ? a.esTitular : undefined,
  plan: a.plan ?? undefined,
  proximoTurno: undefined,
})

export async function fetchAffiliates(): Promise<Affiliate[]> {
  const data = await apiJson<AfiliadoApi[]>(withBase('/afiliados'))
  return data.map(mapAfiliadoApiToAffiliate)
}

export async function createAffiliate(values: AffiliateFormValues): Promise<Affiliate> {
  const payload = {
    numeroAfiliado: values.numeroAfiliado.trim(),
    dni: values.dni.trim(),
    nombreCompleto: values.nombreCompleto.trim(),
    domicilio: values.domicilio.trim() || null,
    localidad: values.localidad.trim() || null,
    codigoPostal: values.codigoPostal.trim() || null,
    partido: values.partido.trim() || null,
    provincia: values.provincia.trim() || null,
    telefono1: values.telefono1.trim() || null,
    telefono2: values.telefono2?.trim() || null,
    email: values.email.trim() || null,
    fechaNacimiento: values.fechaNacimiento || null,
    esTitular: values.esTitular,
    plan: values.plan.trim() || null,
  }

  const created = await apiJson<AfiliadoApi>(withBase('/afiliados'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapAfiliadoApiToAffiliate(created)
}

export async function bajaAfiliadoApi(id: string): Promise<void> {
  await apiJson<unknown>(withBase(`/afiliados/${id}/baja`), {
    method: 'PATCH',
    body: JSON.stringify({ activo: false }),
  })
}

export async function updateAffiliateApi(id: string, values: AffiliateFormValues): Promise<Affiliate> {
  const payload = {
    numeroAfiliado: values.numeroAfiliado.trim(),
    dni: values.dni.trim(),
    nombreCompleto: values.nombreCompleto.trim(),
    domicilio: values.domicilio.trim() || null,
    localidad: values.localidad.trim() || null,
    codigoPostal: values.codigoPostal.trim() || null,
    partido: values.partido.trim() || null,
    provincia: values.provincia.trim() || null,
    telefono1: values.telefono1.trim() || null,
    telefono2: values.telefono2?.trim() || null,
    email: values.email.trim() || null,
    fechaNacimiento: values.fechaNacimiento || null,
    esTitular: values.esTitular,
    plan: values.plan.trim() || null,
  }

  const updated = await apiJson<AfiliadoApi>(withBase(`/afiliados/${id}`), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

  return mapAfiliadoApiToAffiliate(updated)
}

/* ====================================================== TURNOS ====================================================== */

type TurnoApi = {
  id: string
  affiliateId: string
  affiliateName: string
  date: string
  controlDate?: string | null
  time: string
  tipoAtencion: 'especialidad' | 'laboratorio'
  especialidad?: string | null
  laboratorio?: string | null
  plan: string
  prestador: string
  monto: number
  profesional: string
  estado: AppointmentStatus
}

const mapTurnoApiToAppointment = (t: TurnoApi): Appointment => ({
  id: t.id,
  affiliateId: t.affiliateId,
  affiliateName: t.affiliateName,
  affiliateDni: undefined,
  date: t.date.slice(0, 10),
  controlDate: (t.controlDate ?? t.date).slice(0, 10),
  time: t.time.slice(0, 5),
  tipoAtencion: t.tipoAtencion,
  especialidad: t.tipoAtencion === 'especialidad' ? t.especialidad ?? undefined : undefined,
  laboratorio: t.tipoAtencion === 'laboratorio' ? t.laboratorio ?? undefined : undefined,
  plan: t.plan ?? '',
  prestador: t.prestador ?? '',
  monto: t.monto ?? 0,
  profesional: t.profesional ?? '',
  estado: t.estado,
})

export async function fetchTurnos(): Promise<Appointment[]> {
  const data = await apiJson<TurnoApi[]>(withBase('/turnos'))
  return data.map(mapTurnoApiToAppointment)
}

type SaveAppointmentPayload = {
  id?: string
  affiliateId: string
  date: string
  controlDate?: string
  time: string
  tipoAtencion: 'especialidad' | 'laboratorio'
  especialidad?: string
  laboratorio?: string
  plan: string
  prestador: string
  monto: number
  profesional: string
  estado: AppointmentStatus
}

export async function saveTurno(payload: SaveAppointmentPayload): Promise<void> {
  if (payload.id) {
    await apiJson<unknown>(withBase(`/turnos/${payload.id}/estado`), {
      method: 'PATCH',
      body: JSON.stringify({ estado: payload.estado }),
    })
    return
  }

  await apiJson<unknown>(withBase('/turnos'), {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelarTurnoApi(id: string): Promise<void> {
  await apiJson<unknown>(withBase(`/turnos/${id}/estado`), {
    method: 'PATCH',
    body: JSON.stringify({ estado: 'cancelado' as AppointmentStatus }),
  })
}

/* ====================================================== CIERRE DE CAJA ====================================================== */

export type CajaRow = {
  fechaISO: string
  fechaDisplay: string
  numeroAfiliado: string
  dni: string
  nombre: string
  prestador: string
  practica: string
  monto: number
}

export type CierreCajaDto = {
  fechaISO: string
  total: number
  rows: CajaRow[]
}

export type CajaEstadoDto = {
  hoyFechaISO: string
  hoy: CierreCajaDto
  ayerFechaISO: string
  ayer: CierreCajaDto
  historial: { fechaISO: string; total: number }[]
}

type CajaRowApi = {
  fecha: string
  numeroAfiliado: string
  dni: string
  nombreCompleto: string
  prestador: string
  especialidadOLaboratorio: string
  monto: number
}

type CierreCajaApi = {
  fechaISO: string
  total: number
  rows: CajaRowApi[]
}

type CajaEstadoApi = {
  hoyFechaISO: string
  hoy: CierreCajaApi
  ayerFechaISO: string
  ayer: CierreCajaApi
  historial: { fechaISO: string; total: number }[]
}

const isoToDisplay = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const mapCajaRowApiToRow = (fechaISO: string, row: CajaRowApi): CajaRow => ({
  fechaISO,
  fechaDisplay: row.fecha || isoToDisplay(fechaISO),
  numeroAfiliado: row.numeroAfiliado ?? '',
  dni: row.dni ?? '',
  nombre: row.nombreCompleto ?? '',
  prestador: row.prestador ?? '',
  practica: row.especialidadOLaboratorio ?? '',
  monto: row.monto ?? 0,
})

const mapCierreCajaApiToDto = (api: CierreCajaApi): CierreCajaDto => ({
  fechaISO: api.fechaISO,
  total: api.total,
  rows: api.rows.map((r) => mapCajaRowApiToRow(api.fechaISO, r)),
})

export async function fetchCajaEstado(): Promise<CajaEstadoDto> {
  const data = await apiJson<CajaEstadoApi>(withBase('/caja/estado'))
  return {
    hoyFechaISO: data.hoyFechaISO,
    hoy: mapCierreCajaApiToDto(data.hoy),
    ayerFechaISO: data.ayerFechaISO,
    ayer: mapCierreCajaApiToDto(data.ayer),
    historial: data.historial,
  }
}

export async function cerrarCajaApi(dateISO?: string): Promise<CierreCajaDto> {
  const url = dateISO
    ? withBase(`/caja/cerrar?date=${encodeURIComponent(dateISO)}`)
    : withBase('/caja/cerrar')

  const data = await apiJson<CierreCajaApi>(url, { method: 'POST' })
  return mapCierreCajaApiToDto(data)
}

export async function fetchCajaByDate(fechaISO: string): Promise<CierreCajaDto> {
  const data = await apiJson<CierreCajaApi>(withBase(`/caja/${fechaISO}`))
  return mapCierreCajaApiToDto(data)
}

export async function fetchInitialData(): Promise<{
  affiliates: Affiliate[]
  appointments: Appointment[]
}> {
  const [affs, turnos] = await Promise.all([fetchAffiliates(), fetchTurnos()])
  return { affiliates: affs, appointments: turnos }
}
