import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MovilesService } from '../moviles/moviles.service'

type AnyRecord = Record<string, unknown>

type UpsertHistorialInput = {
  fechaISO?: string | null
  movilId?: string | null
  arregloId?: string | null
  horaEntrada?: string | null
  horaSalida?: string | null
  salidaIndefinida?: boolean
  patente?: string | null
  motivo?: string | null
  prioridad?: string | null
  anotaciones?: string | null
  payload?: unknown
}

function isISODateDay(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nowHHMM() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function normStr(v: unknown) {
  const s = String(v ?? '').trim()
  return s.length ? s : null
}

function pickString(obj: AnyRecord, ...keys: string[]) {
  for (const key of keys) {
    if (!(key in obj)) continue
    return normStr(obj[key])
  }
  return undefined
}

function pickBool(obj: AnyRecord, ...keys: string[]) {
  for (const key of keys) {
    if (!(key in obj)) continue
    const raw = obj[key]
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'number') return raw === 1
    const txt = String(raw ?? '').trim().toLowerCase()
    return txt === '1' || txt === 'true' || txt === 'si' || txt === 'sí'
  }
  return undefined
}

function toHHMM(v: unknown): string | null | undefined {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  const match = s.match(/(\d{2}:\d{2})/)
  return match ? match[1] : null
}

@Injectable()
export class HistorialDiaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moviles: MovilesService,
  ) {}

  // ✅ GLOBAL: todos los móviles por fecha
  async listAll(fechaISO: string) {
    const rows = await this.prisma.historialDiaRow.findMany({
      where: { fechaISO },
      orderBy: [{ horaEntrada: 'desc' }, { createdAt: 'desc' }],
      include: { movil: { select: { numero: true } } },
    })

    return rows.map((r) => ({
      id: r.id,
      movil_numero: r.movil?.numero ?? null,
      hora_entrada: r.horaEntrada,
      hora_salida: r.horaSalida,
      salida_indefinida: r.salidaIndefinida,
      patente: r.patente,
      motivo: r.motivo,
      prioridad: r.prioridad,
      anotaciones: r.anotaciones,
    }))
  }

  // ✅ POR MÓVIL
  async listByMovil(movilIdRaw: string, fechaISO: string) {
    const m = await this.moviles.ensureMovil(movilIdRaw)

    const rows = await this.prisma.historialDiaRow.findMany({
      where: { movilId: m.id, fechaISO },
      orderBy: [{ horaEntrada: 'desc' }, { createdAt: 'desc' }],
    })

    return rows.map((r) => ({
      id: r.id,
      movil_numero: m.numero ?? null,
      hora_entrada: r.horaEntrada,
      hora_salida: r.horaSalida,
      salida_indefinida: r.salidaIndefinida,
      patente: r.patente,
      motivo: r.motivo,
      prioridad: r.prioridad,
      anotaciones: r.anotaciones,
    }))
  }

  async upsertFromPayload(input: UpsertHistorialInput) {
    const movilRaw = String(input.movilId || '').trim()
    if (!movilRaw) throw new NotFoundException('Móvil inválido')

    const movil = await this.moviles.ensureMovil(movilRaw)
    const arregloId = normStr(input.arregloId)
    const fechaISO = isISODateDay(String(input.fechaISO || '')) ? String(input.fechaISO) : todayISO()

    const existing = arregloId
      ? await this.prisma.historialDiaRow.findUnique({
          where: { arregloId },
          select: { id: true, horaEntrada: true, horaSalida: true, salidaIndefinida: true },
        })
      : null

    const horaEntrada = toHHMM(input.horaEntrada) ?? existing?.horaEntrada ?? null
    const salidaIndefinida = !!input.salidaIndefinida
    const horaSalida = salidaIndefinida ? null : (toHHMM(input.horaSalida) ?? existing?.horaSalida ?? null)

    const data = {
      movilId: movil.id,
      arregloId,
      fechaISO,
      horaEntrada,
      horaSalida,
      salidaIndefinida,
      patente: normStr(input.patente),
      motivo: normStr(input.motivo),
      prioridad: ((normStr(input.prioridad) || 'baja') as any),
      anotaciones: normStr(input.anotaciones),
      payload: input.payload == null ? undefined : (input.payload as any),
    }

    if (arregloId) {
      await this.prisma.historialDiaRow.upsert({
        where: { arregloId },
        create: data,
        update: data,
      })
      return { ok: true as const }
    }

    await this.prisma.historialDiaRow.create({ data })
    return { ok: true as const }
  }

  // ✅ lo que usa KanbanBoard cuando pasa a Done (o vuelve de Done)
  async updateByArregloId(
    arregloId: string,
    patch: { horaSalida: string | null; salidaIndefinida: boolean },
  ) {
    const arreglo = await this.prisma.arreglo.findUnique({
      where: { id: arregloId },
      include: { movil: true },
    })
    if (!arreglo) throw new NotFoundException('Arreglo no encontrado')

    const movilId = arreglo.movilId
    const fechaISO = isISODateDay(String(arreglo.fechaISO || '')) ? String(arreglo.fechaISO) : todayISO()
    const existing = await this.prisma.historialDiaRow.findUnique({
      where: { arregloId },
      select: { horaEntrada: true },
    })

    await this.prisma.historialDiaRow.upsert({
      where: { arregloId },
      create: {
        movilId,
        arregloId,
        fechaISO,
        horaEntrada: existing?.horaEntrada ?? nowHHMM(),
        horaSalida: patch.salidaIndefinida ? null : patch.horaSalida,
        salidaIndefinida: patch.salidaIndefinida,
        patente: normStr(arreglo.patenteSnap),
        motivo: normStr(arreglo.motivo),
        prioridad: (arreglo.prioridad as any) ?? 'baja',
        anotaciones: normStr(arreglo.anotaciones),
      },
      update: {
        horaSalida: patch.salidaIndefinida ? null : patch.horaSalida,
        salidaIndefinida: patch.salidaIndefinida,
        fechaISO,
        patente: normStr(arreglo.patenteSnap),
        motivo: normStr(arreglo.motivo),
        prioridad: (arreglo.prioridad as any) ?? 'baja',
        anotaciones: normStr(arreglo.anotaciones),
      },
    })

    return { ok: true as const }
  }
}
