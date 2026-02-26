import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MovilesService } from '../moviles/moviles.service'

type Prioridad = 'baja' | 'alta' | 'urgente'

function normPatente(x: any) {
  const s = String(x ?? '').trim()
  return s.length ? s.toUpperCase() : ''
}

function asPrioridad(x: any): Prioridad {
  const v = String(x ?? 'baja').toLowerCase().trim()
  if (v === 'urgente' || v === 'alta' || v === 'baja') return v
  return 'baja'
}

@Injectable()
export class HistorialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moviles: MovilesService,
  ) {}

  // ✅ resumen por patente como el sistema viejo
  async listResumen(movilIdRaw: string | null) {
    let movilDbId: string | null = null

    // Si viene movilId=10, lo convertimos al id real (cuid) usando ensureMovil
    if (movilIdRaw && movilIdRaw.trim()) {
      const m = await this.moviles.ensureMovil(movilIdRaw)
      movilDbId = m.id
    }

    // 1) Traemos todas las combinaciones (patente, movilId, prioridad) con counts
    //    y la última fecha por esa combinación.
    const rows = await this.prisma.historialDiaRow.groupBy({
      by: ['patente', 'movilId', 'prioridad'],
      where: {
        ...(movilDbId ? { movilId: movilDbId } : {}),
        patente: { not: null },
        fechaISO: { not: '' },
      },
      _count: { _all: true },
      _max: { fechaISO: true },
    })

    // 2) Reducimos a resumen por (patente + movilId)
    type Key = string
    const map = new Map<
      Key,
      {
        patente: string
        movilDbId: string
        veces: number
        ultima_fecha: string
        pr_baja: number
        pr_alta: number
        pr_urgente: number
      }
    >()

    for (const r of rows) {
      const patente = normPatente(r.patente)
      if (!patente) continue

      const mId = String(r.movilId)
      const pr = asPrioridad(r.prioridad)
      const count = Number(r._count?._all ?? 0)
      const maxFecha = String(r._max?.fechaISO ?? '')

      const key = `${patente}__${mId}`
      const cur =
        map.get(key) ??
        {
          patente,
          movilDbId: mId,
          veces: 0,
          ultima_fecha: '',
          pr_baja: 0,
          pr_alta: 0,
          pr_urgente: 0,
        }

      cur.veces += count

      // fechaISO "YYYY-MM-DD" => comparación lexicográfica sirve
      if (maxFecha && (!cur.ultima_fecha || maxFecha > cur.ultima_fecha)) {
        cur.ultima_fecha = maxFecha
      }

      if (pr === 'baja') cur.pr_baja += count
      if (pr === 'alta') cur.pr_alta += count
      if (pr === 'urgente') cur.pr_urgente += count

      map.set(key, cur)
    }

    const resumen = Array.from(map.values())

    // 3) Resolver "movil_id" real (numero) desde Movil
    const movilIds = Array.from(new Set(resumen.map((x) => x.movilDbId)))
    const moviles = await this.prisma.movil.findMany({
      where: { id: { in: movilIds } },
      select: { id: true, numero: true },
    })
    const numById = new Map(moviles.map((m) => [m.id, m.numero ?? null]))

    // 4) Shape final (como el viejo)
    const out = resumen
      .map((x) => ({
        patente: x.patente,
        movil_id: numById.get(x.movilDbId) ?? null, // ✅ número real
        veces: x.veces,
        ultima_fecha: x.ultima_fecha || null,
        pr_baja: x.pr_baja,
        pr_alta: x.pr_alta,
        pr_urgente: x.pr_urgente,
      }))
      .sort((a, b) => {
        // orden: última fecha desc, luego veces desc
        const fa = String(a.ultima_fecha ?? '')
        const fb = String(b.ultima_fecha ?? '')
        if (fa !== fb) return fb.localeCompare(fa)
        return Number(b.veces) - Number(a.veces)
      })

    return out
  }
}
