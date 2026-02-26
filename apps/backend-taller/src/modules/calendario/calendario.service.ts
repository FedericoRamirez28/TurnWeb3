// apps/backend-taller/src/modules/calendario/calendario.service.ts

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MovilesService } from '../moviles/moviles.service'
import type { CalendarioEvento, Prioridad } from './calendario.types'

function isISODateDay(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))
}

function rank(p: Prioridad) {
  return p === 'urgente' ? 3 : p === 'alta' ? 2 : 1
}

@Injectable()
export class CalendarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moviles: MovilesService,
  ) {}

  async getCalendario(movilIdRaw: string, range: { from?: string; to?: string }): Promise<CalendarioEvento[]> {
    const m = await this.moviles.ensureMovil(String(movilIdRaw))

    const fromStr = String(range?.from || '').trim()
    const toStr = String(range?.to || '').trim()

    const fromOk = isISODateDay(fromStr) ? fromStr : '1970-01-01'
    const toOk = isISODateDay(toStr) ? toStr : '2100-12-31'

    const fromDate = new Date(`${fromOk}T00:00:00.000Z`)
    const toDate = new Date(`${toOk}T23:59:59.999Z`)

    // 1) Arreglos (por fechaISO)
    const arreglos = await this.prisma.arreglo.findMany({
      where: { movilId: m.id, fechaISO: { gte: fromOk, lte: toOk } },
      select: { id: true, fechaISO: true, prioridad: true },
    })

    // 2) Partes (por fecha DateTime)
    const partes = await this.prisma.parteDiario.findMany({
      where: { movilId: m.id, fecha: { gte: fromDate, lte: toDate } },
      select: { id: true, fecha: true },
    })

    const eventos: CalendarioEvento[] = []

    for (const a of arreglos) {
      if (!a.fechaISO) continue
      const pr = String(a.prioridad || 'baja').toLowerCase() as Prioridad
      eventos.push({
        fecha: a.fechaISO,
        prioridad: pr === 'urgente' || pr === 'alta' || pr === 'baja' ? pr : 'baja',
        tipo: 'arreglo',
        id: a.id,
      })
    }

    for (const p of partes) {
      const iso = p.fecha.toISOString().slice(0, 10)
      eventos.push({
        fecha: iso,
        prioridad: 'baja',
        tipo: 'parte',
        id: p.id,
      })
    }

    return eventos
  }

  // ✅ NUEVO: detalle de un día para “modo lectura” (modal)
  async getDetalleDia(movilIdRaw: string, fechaISO: string) {
    const m = await this.moviles.ensureMovil(String(movilIdRaw))

    const f = String(fechaISO || '').trim()
    if (!isISODateDay(f)) {
      return {
        fecha: f || '',
        prioridadMax: 'baja' as Prioridad,
        arreglos: [],
        partes: [],
      }
    }

    const arreglos = await this.prisma.arreglo.findMany({
      where: { movilId: m.id, fechaISO: f },
      orderBy: { createdAt: 'desc' },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    })

    const partes = await this.prisma.parteDiario.findMany({
      where: {
        movilId: m.id,
        // matchea por día (UTC) usando rango
        fecha: {
          gte: new Date(`${f}T00:00:00.000Z`),
          lte: new Date(`${f}T23:59:59.999Z`),
        },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, chofer: true, kmInicio: true, kmFin: true, fecha: true, createdAt: true },
    })

    let prioridadMax: Prioridad = 'baja'
    for (const a of arreglos) {
      const pr = String(a.prioridad || 'baja').toLowerCase() as Prioridad
      const safe: Prioridad = pr === 'urgente' || pr === 'alta' || pr === 'baja' ? pr : 'baja'
      if (rank(safe) > rank(prioridadMax)) prioridadMax = safe
    }

    // devolvemos “read-only” pero con shape que el frontend pueda mostrar fácil
    return {
      fecha: f,
      prioridadMax,
      arreglos: arreglos.map((a) => ({
        id: a.id,
        patente: a.patenteSnap ?? null,
        fechaISO: a.fechaISO ?? null,
        motivo: a.motivo ?? null,
        anotaciones: a.anotaciones ?? null,
        prioridad: a.prioridad,
        createdAt: a.createdAt.toISOString(),
        tareas: (a.tareas || []).map((t) => ({
          id: t.id,
          texto: t.texto,
          completa: !!t.completa,
          orden: t.orden,
        })),
      })),
      partes: partes.map((p) => ({
        id: p.id,
        fechaISO: p.fecha.toISOString().slice(0, 10),
        chofer: p.chofer ?? null,
        km_inicio: p.kmInicio ?? null,
        km_fin: p.kmFin ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
    }
  }
}
