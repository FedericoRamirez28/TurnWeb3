import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateParteDiarioDto } from './dto/create-parte-diario.dto'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function isDigits(s: string) {
  return /^[0-9]+$/.test(String(s || '').trim())
}

@Injectable()
export class ParteDiarioService {
  constructor(private readonly prisma: PrismaService) {}

  private checkKey(dto: CreateParteDiarioDto) {
    const configured = String(process.env.PARTE_DIARIO_KEY || '').trim()
    if (!configured) return
    const got = String(dto.pd_key || '').trim()
    if (!got || got !== configured) throw new UnauthorizedException('pd_key inválida')
  }

  /** Acepta "10" (numero) o "cuid" (id) y devuelve el Movil real */
  async resolveMovil(param: string) {
    const raw = String(param || '').trim()
    if (!raw) throw new NotFoundException('Móvil inválido')

    let movil =
      isDigits(raw)
        ? await this.prisma.movil.findUnique({ where: { numero: Number(raw) } })
        : await this.prisma.movil.findUnique({ where: { id: raw } })

    if (!movil) throw new NotFoundException('Móvil no encontrado')
    return movil
  }

  async crear(movilParam: string, dto: CreateParteDiarioDto) {
    this.checkKey(dto)

    const movil = await this.resolveMovil(movilParam)

    // fecha del parte (día). Guardamos DateTime a partir del YYYY-MM-DD
    const fechaISO = (dto.fecha || todayISO()).slice(0, 10)
    const fecha = new Date(`${fechaISO}T00:00:00.000Z`)

    const patente = String(dto.patente || '').trim().toUpperCase()
    const chofer = String(dto.chofer || '').trim()
    const kmInicio = Number(dto.km_inicio)
    const kmFin = Number(dto.km_fin)

    if (!patente || !chofer || !Number.isFinite(kmInicio) || !Number.isFinite(kmFin)) {
      // validación extra, por si llegan strings raras
      throw new Error('Datos inválidos')
    }

    const created = await this.prisma.parteDiario.create({
      data: {
        movilId: movil.id,
        fecha,
        patente,
        chofer,
        kmInicio: Math.trunc(kmInicio),
        kmFin: Math.trunc(kmFin),
        observaciones: dto.observaciones ? String(dto.observaciones).trim() : null,
      },
      select: { id: true, createdAt: true },
    })

    return created
  }

  async ultimo(movilParam: string) {
    const movil = await this.resolveMovil(movilParam)

    const row = await this.prisma.parteDiario.findFirst({
      where: { movilId: movil.id },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        fecha: true,
        patente: true,
        chofer: true,
        kmInicio: true,
        kmFin: true,
        observaciones: true,
        createdAt: true,
      },
    })

    if (!row) return null

    // ✅ shape compatible con tu ArreglosScreen
    return {
      fechaISO: row.fecha.toISOString().slice(0, 10),
      patente: row.patente ?? null,
      chofer: row.chofer ?? null,
      km_inicio: row.kmInicio ?? null,
      km_fin: row.kmFin ?? null,
      observaciones: row.observaciones ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }

  /** (Opcional) listar partes del día para calendario */
  async porDia(movilParam: string, fechaISO: string) {
    const movil = await this.resolveMovil(movilParam)
    const iso = String(fechaISO || '').slice(0, 10)
    const d0 = new Date(`${iso}T00:00:00.000Z`)
    const d1 = new Date(`${iso}T23:59:59.999Z`)

    const rows = await this.prisma.parteDiario.findMany({
      where: { movilId: movil.id, fecha: { gte: d0, lte: d1 } },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        fecha: true,
        chofer: true,
        kmInicio: true,
        kmFin: true,
        createdAt: true,
      },
    })

    return rows.map((p) => ({
      id: p.id,
      fechaISO: p.fecha.toISOString().slice(0, 10),
      chofer: p.chofer ?? null,
      km_inicio: p.kmInicio ?? null,
      km_fin: p.kmFin ?? null,
      createdAt: p.createdAt.toISOString(),
    }))
  }
}
