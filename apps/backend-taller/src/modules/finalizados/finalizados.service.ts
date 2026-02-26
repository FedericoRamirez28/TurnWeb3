import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MovilesService } from '../moviles/moviles.service'

function arr(x: any) {
  return Array.isArray(x) ? x : []
}

function str(x: any) {
  const s = String(x ?? '').trim()
  return s.length ? s : ''
}

function toNumOrNull(x: any): number | null {
  if (x === null || x === undefined) return null
  const s = String(x).trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

@Injectable()
export class FinalizadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moviles: MovilesService,
  ) {}

  async list(movilIdRaw: string | null) {
    let movilId: string | null = null

    if (movilIdRaw && movilIdRaw.trim()) {
      const m = await this.moviles.ensureMovil(movilIdRaw)
      movilId = m.id
    }

    const rows = await this.prisma.finalizadoItem.findMany({
      where: movilId ? { movilId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        movil: { select: { numero: true } },
      },
    })

    return rows.map((r) => {
      const p: any = r.payload ?? {}
      const tareas = arr(p?.tareas)

      const numeroReal = toNumOrNull(r.movil?.numero)

      return {
        id: r.id,
        movilNumero: numeroReal,
        movil_id: numeroReal, // compat frontend actual
        patente: str(p?.patente ?? p?.patenteSnap ?? p?.patente_fija ?? p?.patenteFija),
        fecha: str(p?.fecha ?? p?.fechaISO ?? p?.fecha_iso),
        anotaciones: str(p?.anotaciones),
        prioridad: (p?.prioridad ?? null) as any,
        tareas: tareas.map((t: any) => ({
          texto: str(t?.texto ?? t?.text),
          completa: !!(t?.completa ?? t?.done ?? false),
        })),
        createdAt: r.createdAt,
      }
    })
  }

  async finalizar(movilIdRaw: string, arreglosPayload: any[]) {
    const m = await this.moviles.ensureMovil(movilIdRaw)
    const payloads = (arreglosPayload || []).filter(Boolean)

    // 1) guardo snapshots
    await this.prisma.finalizadoItem.createMany({
      data: payloads.map((p) => ({
        movilId: m.id,
        payload: p,
      })),
    })

    // 2) ✅ NO borro: ARCHIVO (para que el calendario mantenga el dot)
    const ids = payloads
      .map((p) => p?.id)
      .filter((x) => typeof x === 'string' && x.length > 0)

    if (ids.length) {
      await this.prisma.arreglo.updateMany({
        where: { id: { in: ids } },
        data: { archived: true, archivedAt: new Date() },
      })
    }

    return { ok: true as const }
  }
}
