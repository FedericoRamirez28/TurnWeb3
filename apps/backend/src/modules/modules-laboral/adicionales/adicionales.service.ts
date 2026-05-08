import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateAdicionalDto } from './adicionales.dto';

function isISODateDay(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function norm(s: string) {
  return String(s ?? '').trim();
}
function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

@Injectable()
export class AdicionalesService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveUserId(userKey: string): Promise<string> {
    const key = norm(userKey);
    if (!key)
      throw new BadRequestException('Falta x-user-id (o usuario autenticado)');

    // Si viene UUID, verificamos existencia
    if (isUuid(key)) {
      const u = await this.prisma.user.findUnique({
        where: { id: key },
        select: { id: true },
      });
      if (!u)
        throw new BadRequestException('Usuario (uuid) no existe en users');
      return u.id;
    }

    // Si no es UUID, lo tratamos como username
    const username = key;

    const existing = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing) return existing.id;

    // DEV: lo creamos automáticamente
    const created = await this.prisma.user.create({
      data: {
        username,
        displayName: username,
        passwordHash: 'dev', // placeholder en dev
        role: 'recepcion',
        activo: true,
      },
      select: { id: true },
    });

    return created.id;
  }

  async list(
    userKey: string,
    args: {
      from?: string;
      to?: string;
      q?: string;
      empresa?: string;
      take?: number;
    },
  ) {
    const userId = await this.resolveUserId(userKey);
    const { from, to, q, empresa } = args;

    if (from && !isISODateDay(from))
      throw new BadRequestException('from inválido (YYYY-MM-DD)');
    if (to && !isISODateDay(to))
      throw new BadRequestException('to inválido (YYYY-MM-DD)');

    const where: Prisma.LaboralAdicionalWhereInput = { userId };

    if (from || to) {
      where.fechaISO = {};
      if (from) (where.fechaISO as Prisma.StringFilter).gte = from;
      if (to) (where.fechaISO as Prisma.StringFilter).lte = to;
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

    const items = await this.prisma.laboralAdicional.findMany({
      where,
      orderBy: [{ fechaISO: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(args.take ?? 500, 2000),
      select: {
        id: true,
        empresa: true,
        nroAfiliado: true,
        nombre: true,
        dni: true,
        adicional: true,
        fechaISO: true,
        createdAt: true,
      },
    });

    return {
      items: items.map((x) => ({
        ...x,
        nroAfiliado: x.nroAfiliado ?? '',
        createdAt: x.createdAt.toISOString(),
      })),
    };
  }

  async createBatch(userKey: string, items: CreateAdicionalDto[]) {
    const userId = await this.resolveUserId(userKey);

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('items vacío');
    }

    const cleaned = items.map((it) => {
      const fechaISO = norm(it.fechaISO);
      if (!isISODateDay(fechaISO)) {
        throw new BadRequestException('fechaISO inválida (YYYY-MM-DD)');
      }

      return {
        userId,
        empresa: norm(it.empresa),
        nroAfiliado: it.nroAfiliado ? norm(it.nroAfiliado) : null,
        nombre: norm(it.nombre),
        dni: norm(it.dni),
        adicional: norm(it.adicional),
        fechaISO,
      };
    });

    const res = await this.prisma.laboralAdicional.createMany({
      data: cleaned,
      skipDuplicates: true,
    });

    return { inserted: res.count };
  }

  async delete(userKey: string, id: string) {
    const userId = await this.resolveUserId(userKey);

    const found = await this.prisma.laboralAdicional.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!found) return { ok: true as const };

    await this.prisma.laboralAdicional.delete({ where: { id } });
    return { ok: true as const };
  }
}
