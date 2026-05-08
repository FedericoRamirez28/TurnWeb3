import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateOrUpdatePortadaDto } from './portadas.dto';

function isISODateDay(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function norm(s: string) {
  return String(s ?? '').trim();
}

@Injectable()
export class PortadasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, args: { q?: string; take?: number }) {
    const take = Math.min(Math.max(args.take ?? 200, 1), 500);

    const where: Prisma.LaboralPortadaWhereInput = { userId };

    const q = norm(args.q ?? '');
    if (q) {
      where.OR = [
        { apellidoNombre: { contains: q, mode: 'insensitive' } },
        { dni: { contains: q, mode: 'insensitive' } },
        { nroSocio: { contains: q, mode: 'insensitive' } },
        { domicilio: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.laboralPortada.findMany({
      where,
      take,
      orderBy: [{ apellidoNombre: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getById(userId: string, id: string) {
    return this.prisma.laboralPortada.findFirst({
      where: { id, userId },
    });
  }

  async upsertByDni(userId: string, dto: CreateOrUpdatePortadaDto) {
    const apellidoNombre = norm(dto.apellidoNombre);
    const dni = norm(dto.dni);

    if (!apellidoNombre) {
      throw new BadRequestException('apellidoNombre requerido');
    }
    if (!dni) {
      throw new BadRequestException('dni requerido');
    }

    const fechaNacimiento = dto.fechaNacimiento
      ? norm(dto.fechaNacimiento)
      : null;
    if (fechaNacimiento && !isISODateDay(fechaNacimiento)) {
      throw new BadRequestException('fechaNacimiento inválida (YYYY-MM-DD)');
    }

    // ✅ Usamos Unchecked para setear userId directo
    const data: Prisma.LaboralPortadaUncheckedCreateInput = {
      userId,
      apellidoNombre,
      dni,
      nroSocio: dto.nroSocio ? norm(dto.nroSocio) : null,
      domicilio: dto.domicilio ? norm(dto.domicilio) : null,
      fechaNacimiento,
    };

    // ✅ Con tu schema: @@unique([userId, dni]) => Prisma genera userId_dni
    return this.prisma.laboralPortada.upsert({
      where: { userId_dni: { userId, dni } },
      create: data,
      update: {
        apellidoNombre: data.apellidoNombre,
        nroSocio: data.nroSocio,
        domicilio: data.domicilio,
        fechaNacimiento: data.fechaNacimiento,
      },
    });
  }

  async delete(userId: string, id: string) {
    const found = await this.prisma.laboralPortada.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!found) return;

    await this.prisma.laboralPortada.delete({ where: { id } });
  }
}
