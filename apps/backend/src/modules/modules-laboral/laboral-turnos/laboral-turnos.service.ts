/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function isMonthKey(s: string) {
  return /^\d{4}-\d{2}$/.test(s)
}

function nextMonthKey(month: string) {
  const [yy, mm] = month.split('-').map((x) => Number(x))
  const d = new Date(yy, mm - 1 + 1, 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function isHHmm(s: string) {
  if (!/^\d{2}:\d{2}$/.test(s)) return false
  const [hh, mm] = s.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return false
  if (hh < 0 || hh > 23) return false
  if (mm < 0 || mm > 59) return false
  return true
}

function isSedeKey(s: string) {
  return s === 'sanjusto' || s === 'caba'
}

function isNonEmptyStringOrUndefined(v: unknown) {
  if (v === undefined) return true
  return typeof v === 'string' && v.trim().length > 0
}

@Injectable()
export class LaboralTurnosService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: {
      sede: 'caba' | 'sanjusto'
      empresa: string
      nombre: string
      dni: string
      nroAfiliado?: string
      puesto: string
      tipoExamen: string
      fechaRecepcionISO: string
      fechaTurnoISO: string
      horaTurno: string
    },
    createdByUserId?: string,
  ) {
    const empresa = String(dto.empresa ?? '').trim()
    const nombre = String(dto.nombre ?? '').trim()
    const dni = String(dto.dni ?? '').trim()
    const puesto = String(dto.puesto ?? '').trim()
    const tipoExamen = String(dto.tipoExamen ?? '').trim()
    const horaTurno = String(dto.horaTurno ?? '').trim()

    if (!empresa) throw new BadRequestException('Empresa requerida')
    if (!nombre) throw new BadRequestException('Nombre requerido')
    if (!dni) throw new BadRequestException('DNI requerido')
    if (!puesto) throw new BadRequestException('Puesto requerido')
    if (!tipoExamen) throw new BadRequestException('Tipo de examen requerido')

    if (!isISODate(dto.fechaRecepcionISO))
      throw new BadRequestException('Fecha recepción inválida')
    if (!isISODate(dto.fechaTurnoISO))
      throw new BadRequestException('Fecha turno inválida')

    if (!horaTurno) throw new BadRequestException('Hora del turno requerida')
    if (!isHHmm(horaTurno))
      throw new BadRequestException('Hora turno inválida (HH:mm)')

    const company = await this.prisma.laboralCompany.findFirst({
      where: { nombre: { equals: empresa, mode: 'insensitive' } },
    })

    const companyRow = company
      ? company
      : await this.prisma.laboralCompany.create({
          data: {
            nombre: empresa,
            isActive: true,
            createdByUserId: createdByUserId ?? null,
          },
        })

    const employee = await this.prisma.laboralEmployee.upsert({
      where: { companyId_dni: { companyId: companyRow.id, dni } },
      update: {
        nombre,
        nroAfiliado: dto.nroAfiliado?.trim() || null,
        puesto,
        isActive: true,
      },
      create: {
        companyId: companyRow.id,
        dni,
        nombre,
        nroAfiliado: dto.nroAfiliado?.trim() || null,
        puesto,
        isActive: true,
      },
    })

    const exists = await this.prisma.laboralTurno.findFirst({
      where: {
        employeeId: employee.id,
        fechaTurnoISO: dto.fechaTurnoISO,
        horaTurno,
        tipoExamen,
        sede: dto.sede,
      },
      select: { id: true },
    })

    if (exists) {
      throw new BadRequestException('Ese turno laboral ya existe (duplicado)')
    }

    const turno = await this.prisma.laboralTurno.create({
      data: {
        sede: dto.sede,
        fechaRecepcionISO: dto.fechaRecepcionISO,
        fechaTurnoISO: dto.fechaTurnoISO,
        horaTurno,
        tipoExamen,

        companyId: companyRow.id,
        employeeId: employee.id,

        nombreSnap: nombre,
        dniSnap: dni,
        nroAfiliadoSnap: dto.nroAfiliado?.trim() || null,
        puestoSnap: puesto,

        createdByUserId: createdByUserId ?? null,
      },
      select: {
        id: true,
        sede: true,
        fechaRecepcionISO: true,
        fechaTurnoISO: true,
        horaTurno: true,
        tipoExamen: true,
        createdAt: true,
        company: { select: { id: true, nombre: true } },
        employee: {
          select: {
            id: true,
            dni: true,
            nombre: true,
            nroAfiliado: true,
            puesto: true,
          },
        },
      },
    })

    return { turno }
  }

  // ✅ ahora acepta sede
  async list(input: {
    q?: string
    from?: string
    to?: string
    month?: string
    sede?: string
  }) {
    const q = String(input.q ?? '').trim()
    const from = String(input.from ?? '').trim()
    const to = String(input.to ?? '').trim()
    const month = String(input.month ?? '').trim()
    const sede = String(input.sede ?? '').trim()

    let rangeFrom = ''
    let rangeToExclusive = ''

    if (month) {
      if (!isMonthKey(month))
        throw new BadRequestException('month inválido (YYYY-MM)')
      const next = nextMonthKey(month)
      rangeFrom = `${month}-01`
      rangeToExclusive = `${next}-01`
    }

    if (from && !isISODate(from))
      throw new BadRequestException('from inválido (YYYY-MM-DD)')
    if (to && !isISODate(to))
      throw new BadRequestException('to inválido (YYYY-MM-DD)')

    if (!rangeFrom && from) rangeFrom = from

    if (!rangeToExclusive && to) {
      const d = new Date(to + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      rangeToExclusive = `${y}-${m}-${dd}`
    }

    const where: Prisma.LaboralTurnoWhereInput = {}

    if (rangeFrom || rangeToExclusive) {
      where.fechaTurnoISO = {}
      if (rangeFrom)
        (where.fechaTurnoISO as Prisma.StringFilter).gte = rangeFrom
      if (rangeToExclusive)
        (where.fechaTurnoISO as Prisma.StringFilter).lt = rangeToExclusive
    }

    if (sede) {
      if (!isSedeKey(sede))
        throw new BadRequestException('sede inválida (caba | sanjusto)')
      where.sede = sede as 'caba' | 'sanjusto'
    }

    if (q) {
      where.OR = [
        { company: { nombre: { contains: q, mode: 'insensitive' } } },
        { employee: { dni: { contains: q, mode: 'insensitive' } } },
        { employee: { nombre: { contains: q, mode: 'insensitive' } } },
        { employee: { nroAfiliado: { contains: q, mode: 'insensitive' } } },
        { employee: { puesto: { contains: q, mode: 'insensitive' } } },
        { tipoExamen: { contains: q, mode: 'insensitive' } },
        { sede: { contains: q, mode: 'insensitive' } },
        { horaTurno: { contains: q, mode: 'insensitive' } },
      ]
    }

    // ✅ CLAVE: traemos los snapshots
    const rows = await this.prisma.laboralTurno.findMany({
      where,
      orderBy: [{ fechaTurnoISO: 'desc' }, { createdAt: 'asc' }],
      take: 500,
      select: {
        id: true,
        sede: true,
        fechaRecepcionISO: true,
        fechaTurnoISO: true,
        horaTurno: true,
        tipoExamen: true,
        createdAt: true,

        nombreSnap: true,
        dniSnap: true,
        nroAfiliadoSnap: true,
        puestoSnap: true,

        company: { select: { id: true, nombre: true } },
        employee: {
          select: {
            id: true,
            dni: true,
            nombre: true,
            nroAfiliado: true,
            puesto: true,
          },
        },
      },
    })

    const turnos = rows.map((r) => ({
      id: r.id,
      sede: r.sede,
      empresa: r.company.nombre,
      companyId: r.company.id,
      employeeId: r.employee.id,

      // ✅ mostrar lo editado
      nombre: (r.nombreSnap ?? r.employee.nombre) || '',
      dni: (r.dniSnap ?? r.employee.dni) || '',
      nroAfiliado: (r.nroAfiliadoSnap ?? r.employee.nroAfiliado ?? '') || '',
      puesto: (r.puestoSnap ?? r.employee.puesto ?? '') || '',

      fechaRecepcionISO: r.fechaRecepcionISO,
      fechaTurnoISO: r.fechaTurnoISO,
      horaTurno: r.horaTurno ?? '',
      tipoExamen: r.tipoExamen,
      createdAt: r.createdAt.toISOString(),
    }))

    return { turnos }
  }

  // ✅ UPDATE (PATCH) para el lápiz
  async update(
    id: string,
    dto: Partial<{
      nombre: string
      dni: string
      nroAfiliado?: string | null
      puesto: string
      tipoExamen: string
      fechaTurnoISO: string
      horaTurno: string
    }>,
  ) {
    const tid = String(id || '').trim()
    if (!tid) throw new BadRequestException('id requerido')

    if (!isNonEmptyStringOrUndefined(dto.nombre))
      throw new BadRequestException('nombre inválido')
    if (!isNonEmptyStringOrUndefined(dto.dni))
      throw new BadRequestException('dni inválido')
    if (!isNonEmptyStringOrUndefined(dto.puesto))
      throw new BadRequestException('puesto inválido')
    if (!isNonEmptyStringOrUndefined(dto.tipoExamen))
      throw new BadRequestException('tipoExamen inválido')

    if (dto.fechaTurnoISO !== undefined && !isISODate(String(dto.fechaTurnoISO)))
      throw new BadRequestException('fechaTurnoISO inválida (YYYY-MM-DD)')

    if (dto.horaTurno !== undefined) {
      const ht = String(dto.horaTurno || '').trim()
      if (!ht) throw new BadRequestException('horaTurno requerida')
      if (!isHHmm(ht)) throw new BadRequestException('horaTurno inválida (HH:mm)')
    }

    try {
      const updated = await this.prisma.laboralTurno.update({
        where: { id: tid },
        data: {
          ...(dto.fechaTurnoISO !== undefined ? { fechaTurnoISO: String(dto.fechaTurnoISO).trim() } : {}),
          ...(dto.horaTurno !== undefined ? { horaTurno: String(dto.horaTurno).trim() } : {}),
          ...(dto.tipoExamen !== undefined ? { tipoExamen: String(dto.tipoExamen).trim() } : {}),

          ...(dto.nombre !== undefined ? { nombreSnap: String(dto.nombre).trim() } : {}),
          ...(dto.dni !== undefined ? { dniSnap: String(dto.dni).trim() } : {}),
          ...(dto.nroAfiliado !== undefined
            ? { nroAfiliadoSnap: dto.nroAfiliado ? String(dto.nroAfiliado).trim() : null }
            : {}),
          ...(dto.puesto !== undefined ? { puestoSnap: String(dto.puesto).trim() } : {}),
        },
        select: {
          id: true,
          sede: true,
          fechaRecepcionISO: true,
          fechaTurnoISO: true,
          horaTurno: true,
          tipoExamen: true,
          createdAt: true,

          nombreSnap: true,
          dniSnap: true,
          nroAfiliadoSnap: true,
          puestoSnap: true,

          company: { select: { id: true, nombre: true } },
          employee: {
            select: {
              id: true,
              dni: true,
              nombre: true,
              nroAfiliado: true,
              puesto: true,
            },
          },
        },
      })

      const turno = {
        id: updated.id,
        sede: updated.sede,
        empresa: updated.company.nombre,
        companyId: updated.company.id,
        employeeId: updated.employee.id,

        nombre: (updated.nombreSnap ?? updated.employee.nombre) || '',
        dni: (updated.dniSnap ?? updated.employee.dni) || '',
        nroAfiliado: (updated.nroAfiliadoSnap ?? updated.employee.nroAfiliado ?? '') || '',
        puesto: (updated.puestoSnap ?? updated.employee.puesto ?? '') || '',

        fechaRecepcionISO: updated.fechaRecepcionISO,
        fechaTurnoISO: updated.fechaTurnoISO,
        horaTurno: updated.horaTurno ?? '',
        tipoExamen: updated.tipoExamen,
        createdAt: updated.createdAt.toISOString(),
      }

      return { turno }
    } catch {
      throw new NotFoundException('Turno no encontrado')
    }
  }

  async remove(id: string) {
    const tid = String(id || '').trim()
    if (!tid) throw new BadRequestException('id requerido')

    try {
      await this.prisma.laboralTurno.delete({ where: { id: tid } })
      return { ok: true }
    } catch {
      throw new NotFoundException('Turno no encontrado')
    }
  }
}
