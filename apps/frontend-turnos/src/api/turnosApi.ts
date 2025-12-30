// apps/frontend-laboral/src/api/turnosApi.ts
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
    body: JSON.stringify(payload),
  })

  return mapAfiliadoApiToAffiliate(created)
}

export async function bajaAfiliadoApi(id: string): Promise<void> {
  await apiJson('/afiliados/' + id + '/baja', {
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

  const updated = await apiJson<AfiliadoApi>(`/afiliados/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
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

  // ✅ NUEVO: Mercado Pago (opcionales)
  mpPagado?: boolean | null
  mpMonto?: number | null
  mpRef?: string | null
}

const mapTurnoApiToAppointment = (t: TurnoApi): Appointment => ({
  id: t.id,
  affiliateId: t.affiliateId,
  affiliateName: t.affiliateName,
  affiliateDni: undefined,
  date: String(t.date ?? '').slice(0, 10),
  controlDate: String((t.controlDate ?? t.date) ?? '').slice(0, 10),
  time: String(t.time ?? '').slice(0, 5),
  tipoAtencion: t.tipoAtencion,
  especialidad: t.tipoAtencion === 'especialidad' ? t.especialidad ?? undefined : undefined,
  laboratorio: t.tipoAtencion === 'laboratorio' ? t.laboratorio ?? undefined : undefined,
  plan: t.plan ?? '',
  prestador: t.prestador ?? '',
  monto: t.monto ?? 0,
  profesional: t.profesional ?? '',
  estado: t.estado,

  // ✅ NUEVO
  mpPagado: Boolean(t.mpPagado),
  mpMonto: typeof t.mpMonto === 'number' ? t.mpMonto : 0,
  mpRef: t.mpRef ?? undefined,
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

  // ✅ NUEVO
  mpPagado?: boolean
  mpMonto?: number
  mpRef?: string
}

export async function saveTurno(payload: SaveAppointmentPayload): Promise<void> {
  // ✅ IMPORTANTE:
  // En tu backend actual, POST /turnos sirve para crear *y* actualizar si mandás "id".
  // No uses PATCH /estado para actualizar monto/fecha/etc (solo cambia estado).
  await apiJson('/turnos', {
    method: 'POST',
    body: JSON.stringify({
      id: payload.id,
      affiliateId: payload.affiliateId,
      date: payload.date,
      controlDate: payload.controlDate,
      time: payload.time,
      tipoAtencion: payload.tipoAtencion,
      especialidad: payload.especialidad,
      laboratorio: payload.laboratorio,
      plan: payload.plan,
      prestador: payload.prestador,
      monto: payload.monto,
      profesional: payload.profesional,
      estado: payload.estado,

      // ✅ NUEVO MP
      mpPagado: Boolean(payload.mpPagado),
      mpMonto: Number(payload.mpMonto ?? 0),
      mpRef: payload.mpRef ?? null,
    }),
  })
}

export async function cancelarTurnoApi(id: string): Promise<void> {
  await apiJson(`/turnos/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: 'cancelado' as AppointmentStatus }),
  })
}

export async function updateEstadoTurnoApi(id: string, estado: AppointmentStatus): Promise<void> {
  await apiJson(`/turnos/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  })
}

export async function fetchInitialData(): Promise<{ affiliates: Affiliate[]; appointments: Appointment[] }> {
  const [affs, turnos] = await Promise.all([fetchAffiliates(), fetchTurnos()])
  return { affiliates: affs, appointments: turnos }
}

/* ================= CAJA ================= */

/* ================= CAJA (BACKEND DTO -> FRONT DTO) ================= */

export type CajaRow = {
  fechaDisplay: string
  numeroAfiliado: string
  dni: string
  nombre: string
  prestador: string
  practica: string // Especialidad o Laboratorio
  monto: number
}

// DTO real del backend (CajaRowDto)
type CajaRowDtoApi = {
  fecha: string
  numeroAfiliado: string
  dni: string
  nombreCompleto: string
  prestador: string
  especialidadOLaboratorio: string
  monto: number
}

export type CierreCajaDto = {
  fechaISO: string
  total: number
  rows: CajaRow[]
}

// DTO real del backend (CajaEstadoDto)
type CajaEstadoDtoApi = {
  hoyFechaISO: string
  hoy: {
    fechaISO: string
    total: number
    rows: CajaRowDtoApi[]
  }
  ayerFechaISO: string
  ayer: {
    fechaISO: string
    total: number
    rows: CajaRowDtoApi[]
  }
  historial: Array<{ fechaISO: string; total: number }>
}

export type CajaEstadoDto = {
  hoyFechaISO: string
  hoy: CierreCajaDto
  ayerFechaISO: string
  ayer: CierreCajaDto
  historial: Array<{ fechaISO: string; total: number }>
}

const toNumber = (v: unknown): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

const mapCajaRow = (r: CajaRowDtoApi): CajaRow => ({
  fechaDisplay: r.fecha ?? '—',
  numeroAfiliado: r.numeroAfiliado ?? '—',
  dni: r.dni ?? '—',
  nombre: r.nombreCompleto ?? '—',
  prestador: r.prestador ?? '—',
  practica: r.especialidadOLaboratorio ?? '—',
  monto: toNumber(r.monto),
})

const mapCierreCaja = (c: { fechaISO: string; total: number; rows: CajaRowDtoApi[] }): CierreCajaDto => ({
  fechaISO: String(c?.fechaISO ?? ''),
  total: toNumber(c?.total),
  rows: Array.isArray(c?.rows) ? c.rows.map(mapCajaRow) : [],
})

export async function fetchCajaEstado(): Promise<CajaEstadoDto> {
  const raw = await apiJson<CajaEstadoDtoApi>('/caja/estado')

  return {
    hoyFechaISO: raw.hoyFechaISO,
    hoy: mapCierreCaja(raw.hoy),
    ayerFechaISO: raw.ayerFechaISO,
    ayer: mapCierreCaja(raw.ayer),
    historial: (raw.historial ?? []).map((h) => ({
      fechaISO: h.fechaISO,
      total: toNumber(h.total),
    })),
  }
}

// ✅ BACKEND: POST /caja/cerrar?date=YYYY-MM-DD (querystring)
// (tu código de controller usa @Query('date'))
export async function cerrarCajaApi(fechaISO: string): Promise<CierreCajaDto> {
  const raw = await apiJson<{ fechaISO: string; total: number; rows: CajaRowDtoApi[] }>(
    `/caja/cerrar?date=${encodeURIComponent(fechaISO)}`,
    { method: 'POST' },
  )
  return mapCierreCaja(raw)
}

export async function fetchCajaByDate(fechaISO: string): Promise<CierreCajaDto> {
  const raw = await apiJson<{ fechaISO: string; total: number; rows: CajaRowDtoApi[] }>(`/caja/${fechaISO}`)
  return mapCierreCaja(raw)
}
