// apps/backend/src/modules/laboral/consultorios/consultorios.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateConsultorioTurnoDto,
  ConsultorioTurnoResponse,
} from './consultorio.dto';

function isISODateDay(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function norm(s: string) {
  return (s || '').trim();
}

function clampTake(take?: number) {
  if (!Number.isFinite(take) || !take || take <= 0) return 200;
  return Math.min(take, 500);
}

function toResp(x: {
  id: string;
  companyId: string;
  empresaNombreSnap: string;
  dni: string;
  nombre: string;
  nacimientoISO: string | null;
  motivo: string;
  diagnostico: string;
  fechaTurnoISO: string;
  createdAt: Date;
}): ConsultorioTurnoResponse {
  return {
    id: x.id,
    empresaId: x.companyId,
    empresaNombre: x.empresaNombreSnap,
    dni: x.dni,
    nombre: x.nombre,
    nacimientoISO: x.nacimientoISO,
    motivo: x.motivo,
    diagnostico: x.diagnostico,
    fechaTurnoISO: x.fechaTurnoISO,
    createdAt: x.createdAt.toISOString(),
  };
}

@Injectable()
export class ConsultoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    args: {
      from?: string;
      to?: string;
      q?: string;
      companyId?: string;
      take?: number;
    },
  ): Promise<ConsultorioTurnoResponse[]> {
    const { from, to, q, companyId } = args;

    if (from && !isISODateDay(from))
      throw new BadRequestException('from inválido (YYYY-MM-DD)');
    if (to && !isISODateDay(to))
      throw new BadRequestException('to inválido (YYYY-MM-DD)');

    const where: Prisma.LaboralConsultorioTurnoWhereInput = { userId };

    if (from || to) {
      where.fechaTurnoISO = {};
      if (from) (where.fechaTurnoISO as Prisma.StringFilter).gte = from;
      if (to) (where.fechaTurnoISO as Prisma.StringFilter).lte = to;
    }

    if (companyId && companyId.trim()) {
      where.companyId = companyId.trim();
    }

    if (q && q.trim()) {
      const qq = q.trim();
      where.OR = [
        { empresaNombreSnap: { contains: qq, mode: 'insensitive' } },
        { nombre: { contains: qq, mode: 'insensitive' } },
        { dni: { contains: qq, mode: 'insensitive' } },
        { motivo: { contains: qq, mode: 'insensitive' } },
        { diagnostico: { contains: qq, mode: 'insensitive' } },
      ];
    }

    const take = clampTake(args.take);

    const items = await this.prisma.laboralConsultorioTurno.findMany({
      where,
      orderBy: [
        { fechaTurnoISO: 'asc' },
        { empresaNombreSnap: 'asc' },
        { createdAt: 'asc' },
      ],
      take,
    });

    return items.map(toResp);
  }

  async getById(userId: string, id: string): Promise<ConsultorioTurnoResponse> {
    const found = await this.prisma.laboralConsultorioTurno.findFirst({
      where: { id, userId },
    });
    if (!found) throw new NotFoundException('No encontrado');
    return toResp(found);
  }

  async create(
    userId: string,
    dto: CreateConsultorioTurnoDto,
  ): Promise<ConsultorioTurnoResponse> {
    const companyId = norm(dto.companyId);
    const dni = norm(dto.dni);
    const nombre = norm(dto.nombre);
    const motivo = norm(dto.motivo);
    const diagnostico = norm(dto.diagnostico);
    const fechaTurnoISO = norm(dto.fechaTurnoISO);
    const nacimientoISO = dto.nacimientoISO ? norm(dto.nacimientoISO) : null;

    if (!companyId) throw new BadRequestException('companyId requerido');
    if (!dni) throw new BadRequestException('dni requerido');
    if (!nombre) throw new BadRequestException('nombre requerido');
    if (!motivo) throw new BadRequestException('motivo requerido');
    if (!diagnostico) throw new BadRequestException('diagnostico requerido');
    if (!isISODateDay(fechaTurnoISO))
      throw new BadRequestException('fechaTurnoISO inválida (YYYY-MM-DD)');
    if (nacimientoISO && !isISODateDay(nacimientoISO))
      throw new BadRequestException('nacimientoISO inválido (YYYY-MM-DD)');

    const company = await this.prisma.laboralCompany.findFirst({
      where: { id: companyId, isActive: true },
      select: { id: true, nombre: true },
    });
    if (!company)
      throw new BadRequestException('Empresa inexistente o dada de baja');

    try {
      const created = await this.prisma.laboralConsultorioTurno.create({
        data: {
          userId,
          companyId: company.id,
          empresaNombreSnap: company.nombre,
          dni,
          nombre,
          nacimientoISO,
          motivo,
          diagnostico,
          fechaTurnoISO,
        },
      });

      return toResp(created);
    } catch (e: unknown) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          'Ese turno consultorio ya existe (duplicado).',
        );
      }
      throw e;
    }
  }

  async delete(userId: string, id: string): Promise<{ ok: true }> {
    const found = await this.prisma.laboralConsultorioTurno.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!found) return { ok: true };

    await this.prisma.laboralConsultorioTurno.delete({ where: { id } });
    return { ok: true };
  }
}
