import type { Affiliate, Appointment, AppointmentStatus } from '@/components/screens/homeModels'
import type { AffiliateFormValues } from '@/components/ui/home/AffiliateQuicklist'
import { apiJson } from './http'

/* ================= AFILIADOS ================= */

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
  const data = await apiJson<AfiliadoApi[]>('/afiliados')
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

  const created = await apiJson<AfiliadoApi>('/afiliados', {
    method: 'POST',
    body: payload,
  })

  return mapAfiliadoApiToAffiliate(created)
}

export async function bajaAfiliadoApi(id: string): Promise<void> {
  await apiJson('/afiliados/' + id + '/baja', {
    method: 'PATCH',
    body: { activo: false },
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

  const updated = await apiJson<AfiliadoApi>(`/afiliados/${id}`, {
    method: 'PUT',
    body: payload,
  })

  return mapAfiliadoApiToAffiliate(updated)
}

/* ================= TURNOS ================= */

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
  const data = await apiJson<TurnoApi[]>('/turnos')
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
    await apiJson(`/turnos/${payload.id}/estado`, {
      method: 'PATCH',
      body: { estado: payload.estado },
    })
    return
  }

  await apiJson('/turnos', {
    method: 'POST',
    body: payload,
  })
}

export async function cancelarTurnoApi(id: string): Promise<void> {
  await apiJson(`/turnos/${id}/estado`, {
    method: 'PATCH',
    body: { estado: 'cancelado' as AppointmentStatus },
  })
}

export async function fetchInitialData(): Promise<{ affiliates: Affiliate[]; appointments: Appointment[] }> {
  const [affs, turnos] = await Promise.all([fetchAffiliates(), fetchTurnos()])
  return { affiliates: affs, appointments: turnos }
}

/* ================= CAJA (NUEVO) ================= */

export type CajaRow = {
  fechaDisplay: string
  numeroAfiliado: string
  dni: string
  nombre: string
  prestador: string
  practica: string // Especialidad o Laboratorio
  monto: number
}

export type CierreCajaDto = {
  fechaISO: string
  total: number
  rows: CajaRow[]
}

export type CajaEstadoDto = {
  hoyFechaISO: string
  hoy: {
    fechaISO: string
    rows: CajaRow[]
  }
  ayer: CierreCajaDto | null
  historial: Array<{
    fechaISO: string
    total: number
  }>
}

export async function fetchCajaEstado(): Promise<CajaEstadoDto> {
  return apiJson<CajaEstadoDto>('/caja/estado')
}

export async function cerrarCajaApi(fechaISO: string): Promise<CierreCajaDto> {
  return apiJson<CierreCajaDto>('/caja/cerrar', {
    method: 'POST',
    body: { fechaISO },
  })
}

export async function fetchCajaByDate(fechaISO: string): Promise<CierreCajaDto> {
  return apiJson<CierreCajaDto>(`/caja/${fechaISO}`)
}