import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MovilesService } from '../moviles/moviles.service'
import type { CreateArregloDto, UpdateArregloDto } from './dto/arreglos.dto'

@Injectable()
export class ArreglosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moviles: MovilesService,
  ) {}

  // ✅ SOLO ACTIVOS (archived=false) para Kanban/Inbox
  async listByMovil(movilIdRaw: string) {
    const m = await this.moviles.ensureMovil(movilIdRaw)
    return this.prisma.arreglo.findMany({
      where: { movilId: m.id, archived: false },
      orderBy: { createdAt: 'desc' },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    })
  }

  async create(dto: CreateArregloDto) {
    const m = await this.moviles.ensureMovil(dto.movilId)

    const tareas = (dto.tareas || []).map((t, i) => ({
      texto: String(t.texto || '').trim(),
      completa: !!t.completa,
      orden: Number.isFinite(Number(t.orden)) ? Number(t.orden) : i,
    }))

    const row = await this.prisma.arreglo.create({
      data: {
        movilId: m.id,
        patenteSnap: dto.patente?.toUpperCase?.() ?? null,
        fechaISO: dto.fechaISO ?? null,
        motivo: dto.motivo ?? null,
        anotaciones: dto.anotaciones ?? null,
        prioridad: (dto.prioridad as any) ?? 'baja',
        archived: false,
        archivedAt: null,
        tareas: { create: tareas },
      },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    })

    return {
      id: row.id,
      movilId: m.id,
      patente: row.patenteSnap,
      fecha: row.fechaISO,
      motivo: row.motivo,
      anotaciones: row.anotaciones,
      prioridad: row.prioridad,
      tareas: row.tareas.map((t) => ({
        id: t.id,
        texto: t.texto,
        completa: t.completa,
        orden: t.orden,
      })),
      createdAt: row.createdAt,
    }
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

    const row = await this.prisma.arreglo.update({
      where: { id },
      data: {
        patenteSnap: dto.patente?.toUpperCase?.() ?? undefined,
        fechaISO: dto.fechaISO ?? undefined,
        motivo: dto.motivo ?? undefined,
        anotaciones: dto.anotaciones ?? undefined,
        prioridad: (dto.prioridad as any) ?? undefined,
      },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    })

    return {
      id: row.id,
      movilId: row.movilId,
      patente: row.patenteSnap,
      fecha: row.fechaISO,
      motivo: row.motivo,
      anotaciones: row.anotaciones,
      prioridad: row.prioridad,
      tareas: row.tareas.map((t) => ({
        id: t.id,
        texto: t.texto,
        completa: t.completa,
        orden: t.orden,
      })),
      createdAt: row.createdAt,
    }
  }

  async remove(id: string) {
    await this.prisma.arreglo.delete({ where: { id } })
    return { ok: true as const }
  }
}
