// src/modules/laboral/preocupacional/preocupacional.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateAdicionalDto } from './adicionales.dto';
import type { Prisma } from '@prisma/client';

function isISODateDay(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function norm(s: string) {
  return (s || '').trim();
}

@Injectable()
export class PreocupacionalService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdicionales(
    userId: string,
    args: { from?: string; to?: string; q?: string; empresa?: string },
  ) {
    const { from, to, q, empresa } = args;

    if (from && !isISODateDay(from)) {
      throw new BadRequestException('from inválido (YYYY-MM-DD)');
    }
    if (to && !isISODateDay(to)) {
      throw new BadRequestException('to inválido (YYYY-MM-DD)');
    }

    const where: Prisma.LaboralAdicionalWhereInput = { userId };

    if (from || to) {
      where.fechaISO = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };
    }

    if (empresa && empresa.trim()) {
      where.empresa = { contains: empresa.trim(), mode: 'insensitive' };
    }

    if (q && q.trim()) {
      const qq = q.trim();
      where.OR = [
        { empresa: { contains: qq, mode: 'insensitive' } },
        { nombre: { contains: qq, mode: 'insensitive' } },
        { dni: { contains: qq, mode: 'insensitive' } },
        { adicional: { contains: qq, mode: 'insensitive' } },
        { nroAfiliado: { contains: qq, mode: 'insensitive' } },
      ];
    }

    return this.prisma.laboralAdicional.findMany({
      where,
      orderBy: [{ fechaISO: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
  }

  async createAdicionalesBatch(userId: string, items: CreateAdicionalDto[]) {
    if (!items.length) throw new BadRequestException('items vacío');

    const cleaned: Prisma.LaboralAdicionalCreateManyInput[] = items.map(
      (it) => {
        const fechaISO = norm(it.fechaISO);
        if (!isISODateDay(fechaISO)) {
          throw new BadRequestException('fechaISO inválida (YYYY-MM-DD)');
        }

        const empresa = norm(it.empresa);
        const nombre = norm(it.nombre);
        const dni = norm(it.dni);
        const adicional = norm(it.adicional);
        const nroAfiliado = it.nroAfiliado ? norm(it.nroAfiliado) : null;

        if (!empresa) throw new BadRequestException('empresa requerida');
        if (!nombre) throw new BadRequestException('nombre requerido');
        if (!dni) throw new BadRequestException('dni requerido');
        if (!adicional) throw new BadRequestException('adicional requerido');

        return {
          userId,
          empresa,
          nroAfiliado,
          nombre,
          dni,
          adicional,
          fechaISO,
        };
      },
    );

    const res = await this.prisma.laboralAdicional.createMany({
      data: cleaned,
      skipDuplicates: true,
    });

    return { inserted: res.count };
  }

  async deleteAdicional(userId: string, id: string) {
    const found = await this.prisma.laboralAdicional.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!found) return { ok: true };

    await this.prisma.laboralAdicional.delete({ where: { id } });
    return { ok: true };
  }
}
