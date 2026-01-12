import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export type PrestadorListItem = {
  id: string;
  nombre: string;
  isActive: boolean;
};

@Injectable()
export class PrestadoresService {
  constructor(private prisma: PrismaService) {}

  async listActive(): Promise<PrestadorListItem[]> {
    const rows = await this.prisma.prestador.findMany({
      where: { isActive: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, isActive: true },
    });
    return rows;
  }

  async create(input: { nombre: string }): Promise<PrestadorListItem> {
    const nombre = String(input.nombre ?? '').trim();
    const row = await this.prisma.prestador.create({
      data: { nombre, userId: '' as never }, // ⚠️ si tu modelo exige userId, lo manejamos distinto (ver nota abajo)
      select: { id: true, nombre: true, isActive: true },
    });
    return row;
  }

  async setActive(id: string, isActive: boolean): Promise<PrestadorListItem> {
    const row = await this.prisma.prestador.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
      select: { id: true, nombre: true, isActive: true },
    });
    return row;
  }
}
