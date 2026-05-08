import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateLaboralNoteDto, UpdateLaboralNoteDto } from './dto';

@Injectable()
export class LaboralNotesService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.laboralNote.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return rows;
  }

  async create(dto: CreateLaboralNoteDto, userId: string) {
    const text = String(dto.text ?? '').trim();
    if (!text) throw new BadRequestException('Texto requerido');

    const created = await this.prisma.laboralNote.create({
      data: {
        userId,
        text,
        color: dto.color,
      },
    });
    return created;
  }

  async update(id: string, dto: UpdateLaboralNoteDto, userId: string) {
    const found = await this.prisma.laboralNote.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Nota no encontrada');
    if (found.userId !== userId) throw new ForbiddenException('No autorizado');

    const nextText =
      dto.text !== undefined ? String(dto.text ?? '').trim() : undefined;
    if (dto.text !== undefined && !nextText)
      throw new BadRequestException('Texto inválido');

    const updated = await this.prisma.laboralNote.update({
      where: { id },
      data: {
        ...(nextText !== undefined ? { text: nextText } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });
    return updated;
  }

  async remove(id: string, userId: string) {
    const found = await this.prisma.laboralNote.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('Nota no encontrada');
    if (found.userId !== userId) throw new ForbiddenException('No autorizado');

    await this.prisma.laboralNote.delete({ where: { id } });
    return { ok: true };
  }
}
