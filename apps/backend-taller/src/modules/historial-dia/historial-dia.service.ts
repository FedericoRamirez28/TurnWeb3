import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MovilesService } from '../moviles/moviles.service'

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

function normStr(v: any) {
  const s = String(v ?? '').trim()
  return s.length ? s : null
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
      orderBy: [{ horaEntrada: 'asc' }, { createdAt: 'asc' }],
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
      orderBy: [{ horaEntrada: 'asc' }, { createdAt: 'asc' }],
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
    const fechaISO = isISODateDay(String(arreglo.fechaISO || '')) ? (arreglo.fechaISO as string) : todayISO()

    await this.prisma.historialDiaRow.upsert({
      where: { arregloId },
      create: {
        movilId,
        arregloId,
        fechaISO,
        horaEntrada: nowHHMM(),
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
