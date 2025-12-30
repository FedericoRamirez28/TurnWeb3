import { apiJson } from './http'

export type SedeKey = 'caba' | 'sanjusto'

export type LaborTurno = {
  id: string
  sede: SedeKey

  empresa: string
  companyId: string
  employeeId: string

  nombre: string
  dni: string
  nroAfiliado: string
  puesto: string

  fechaRecepcionISO: string
  fechaTurnoISO: string
  tipoExamen: string

  createdAt: string
  horaTurno?: string
}

export type CreateLaborTurnoInput = {
  sede: SedeKey
  empresa: string
  nombre: string
  dni: string
  nroAfiliado?: string
  puesto: string
  tipoExamen: string
  fechaRecepcionISO: string
  fechaTurnoISO: string
  horaTurno: string
}

type BackendCreateResponse = {
  turno: {
    id: string
    sede: SedeKey
    fechaRecepcionISO: string
    fechaTurnoISO: string
    tipoExamen: string
    createdAt: string
    horaTurno?: string
    company: { id: string; nombre: string }
    employee: {
      id: string
      dni: string
      nombre: string
      nroAfiliado: string | null
      puesto: string | null
    }
  }
}

type BackendListResponse = { turnos: LaborTurno[] }

function mapCreateTurnoToLaborTurno(t: BackendCreateResponse['turno']): LaborTurno {
  return {
    id: t.id,
    sede: t.sede,
    empresa: t.company?.nombre ?? '',
    companyId: t.company?.id ?? '',
    employeeId: t.employee?.id ?? '',
    nombre: t.employee?.nombre ?? '',
    dni: t.employee?.dni ?? '',
    nroAfiliado: t.employee?.nroAfiliado ?? '',
    puesto: t.employee?.puesto ?? '',
    fechaRecepcionISO: t.fechaRecepcionISO,
    fechaTurnoISO: t.fechaTurnoISO,
    tipoExamen: t.tipoExamen,
    createdAt: t.createdAt,
    horaTurno: t.horaTurno,
  }
}

export async function laboralTurnoCreate(input: CreateLaborTurnoInput): Promise<LaborTurno> {
  const r = await apiJson<BackendCreateResponse>('/laboral/turnos', {
    method: 'POST',
    body: input,
  })
  return mapCreateTurnoToLaborTurno(r.turno)
}

export async function laboralTurnosList(params?: {
  q?: string
  from?: string
  to?: string
  month?: string
}): Promise<LaborTurno[]> {
  const r = await apiJson<BackendListResponse>('/laboral/turnos', {
    query: {
      q: params?.q?.trim() || undefined,
      from: params?.from?.trim() || undefined,
      to: params?.to?.trim() || undefined,
      month: params?.month?.trim() || undefined,
    },
  })

  return Array.isArray(r.turnos) ? r.turnos : []
}

// ✅ NUEVO: borrar turno
export async function laboralTurnoDelete(id: string): Promise<void> {
  await apiJson<{ ok: boolean }>(`/laboral/turnos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
