import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MovilesService } from '../moviles/moviles.service'
import type { CreateArregloDto, UpdateArregloDto } from './dto/arreglos.dto'

type AnyRecord = Record<string, unknown>

type HistorialLite = {
  horaEntrada?: string | null
  horaSalida?: string | null
  salidaIndefinida?: boolean | null
}

function hasOwn(obj: AnyRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function asRecord(value: unknown): AnyRecord {
  return (value ?? {}) as AnyRecord
}

function readNullableString(obj: AnyRecord, ...keys: string[]): string | null | undefined {
  for (const key of keys) {
    if (!hasOwn(obj, key)) continue
    const raw = obj[key]
    if (raw == null) return null
    const text = String(raw).trim()
    return text ? text : null
  }
  return undefined
}

function readOptionalBool(obj: AnyRecord, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    if (!hasOwn(obj, key)) continue
    const raw = obj[key]
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'number') return raw === 1
    const text = String(raw ?? '').trim().toLowerCase()
    return text === '1' || text === 'true' || text === 'si' || text === 'sí'
  }
  return undefined
}

@Injectable()
export class ArreglosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moviles: MovilesService,
  ) {}

  private toApi(row: any, hist?: HistorialLite | null, fallback?: HistorialLite | null) {
    const horaEntrada = hist?.horaEntrada ?? fallback?.horaEntrada ?? null
    const horaSalida = hist?.horaSalida ?? fallback?.horaSalida ?? null
    const salidaIndefinida = !!(hist?.salidaIndefinida ?? fallback?.salidaIndefinida ?? false)

    return {
      id: row.id,
      movilId: row.movilId,
      patente: row.patenteSnap ?? null,
      fecha: row.fechaISO ?? null,
      fechaISO: row.fechaISO ?? null,
      motivo: row.motivo ?? null,
      anotaciones: row.anotaciones ?? null,
      prioridad: row.prioridad ?? 'baja',
      hora_entrada: horaEntrada,
      horaEntrada,
      hora_salida: horaSalida,
      horaSalida,
      salida_indefinida: salidaIndefinida,
      salidaIndefinida,
      tareas: Array.isArray(row.tareas)
        ? row.tareas.map((t: any) => ({
            id: t.id,
            texto: t.texto,
            completa: t.completa,
            orden: t.orden,
          }))
        : [],
      createdAt: row.createdAt,
    }
  }

  async listByMovil(movilIdRaw: string) {
    const m = await this.moviles.ensureMovil(movilIdRaw)
    const rows: any[] = await this.prisma.arreglo.findMany({
      where: { movilId: m.id, archived: false },
      orderBy: { createdAt: 'desc' },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    })

    const arregloIds = rows.map((row) => String(row.id))
    const historial = arregloIds.length
      ? await this.prisma.historialDiaRow.findMany({
          where: { arregloId: { in: arregloIds } },
          select: { arregloId: true, horaEntrada: true, horaSalida: true, salidaIndefinida: true },
        })
      : []

    const histMap = new Map(
      historial
        .filter((h) => h.arregloId)
        .map((h) => [
          String(h.arregloId),
          { horaEntrada: h.horaEntrada, horaSalida: h.horaSalida, salidaIndefinida: h.salidaIndefinida },
        ]),
    )

    return rows.map((row) => this.toApi(row, histMap.get(String(row.id)) ?? null))
  }

  async create(dto: CreateArregloDto) {
    const m = await this.moviles.ensureMovil(dto.movilId)

    const tareas = (dto.tareas || []).map((t, i) => ({
      texto: String(t.texto || '').trim(),
      completa: !!t.completa,
      orden: Number.isFinite(Number(t.orden)) ? Number(t.orden) : i,
    }))

    const row: any = await this.prisma.arreglo.create({
      data: {
        movilId: m.id,
        patenteSnap: dto.patente?.toUpperCase?.() ?? null,
        fechaISO: dto.fechaISO ?? dto.fecha ?? null,
        motivo: dto.motivo ?? null,
        anotaciones: dto.anotaciones ?? null,
        prioridad: (dto.prioridad as any) ?? 'baja',
        archived: false,
        archivedAt: null,
        tareas: { create: tareas },
      },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    })

    const dtoRecord = asRecord(dto)
    const fallback: HistorialLite = {
      horaEntrada: readNullableString(dtoRecord, 'hora_entrada', 'horaEntrada') ?? null,
      horaSalida: readNullableString(dtoRecord, 'hora_salida', 'horaSalida') ?? null,
      salidaIndefinida: readOptionalBool(dtoRecord, 'salida_indefinida', 'salidaIndefinida') ?? false,
    }

    return this.toApi(row, null, fallback)
  }

  async update(id: string, dto: UpdateArregloDto) {
    const exists = await this.prisma.arreglo.findUnique({ where: { id } })
    if (!exists) throw new NotFoundException('Arreglo no encontrado')

    if (dto.tareas) {
      await this.prisma.tarea.deleteMany({ where: { arregloId: id } })
      const tareas = dto.tareas.map((t, i) => ({
        arregloId: id,
        texto: String(t.texto || '').trim(),
        completa: !!t.completa,
        orden: Number.isFinite(Number(t.orden)) ? Number(t.orden) : i,
      }))
      if (tareas.length) await this.prisma.tarea.createMany({ data: tareas })
    }

    const row: any = await this.prisma.arreglo.update({
      where: { id },
      data: {
        patenteSnap: dto.patente?.toUpperCase?.() ?? undefined,
        fechaISO: dto.fechaISO ?? dto.fecha ?? undefined,
        motivo: dto.motivo ?? undefined,
        anotaciones: dto.anotaciones ?? undefined,
        prioridad: (dto.prioridad as any) ?? undefined,
      },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    })

    const historial = await this.prisma.historialDiaRow.findUnique({
      where: { arregloId: id },
      select: { horaEntrada: true, horaSalida: true, salidaIndefinida: true },
    })

    const dtoRecord = asRecord(dto)
    const fallback: HistorialLite = {
      horaEntrada: readNullableString(dtoRecord, 'hora_entrada', 'horaEntrada') ?? historial?.horaEntrada ?? null,
      horaSalida: readNullableString(dtoRecord, 'hora_salida', 'horaSalida') ?? historial?.horaSalida ?? null,
      salidaIndefinida:
        readOptionalBool(dtoRecord, 'salida_indefinida', 'salidaIndefinida') ?? historial?.salidaIndefinida ?? false,
    }

    return this.toApi(row, historial, fallback)
  }

  async remove(id: string) {
    await this.prisma.arreglo.delete({ where: { id } })
    return { ok: true as const }
  }
}
