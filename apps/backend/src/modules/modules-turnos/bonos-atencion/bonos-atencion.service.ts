import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BonoScanResult, BonoStatus } from '@prisma/client';
import type { CreateBonoAtencionDto } from './bonos-atencion.dto';

type VerifyMeta = {
  ip?: string;
  userAgent?: string;
  // ✅ controller manda userId (sub). Acá lo convertimos a prestadorId.
  prestadorUserId?: string;
};

@Injectable()
export class BonosAtencionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBonoAtencionDto, createdByUserId: string) {
    // Ojo: acá asumo que dto ya trae afiliadoId, prestadorId, etc.
    // Si tu dto es distinto, lo adaptamos.
    if (!dto.afiliadoId) throw new BadRequestException('afiliadoId requerido');
    if (!dto.prestadorId)
      throw new BadRequestException('prestadorId requerido');
    if (!dto.practica?.trim())
      throw new BadRequestException('practica requerida');

    // code MED-XXXXXX
    const code = await this.generateUniqueCode();

    const afiliado = await this.prisma.afiliado.findUnique({
      where: { id: dto.afiliadoId },
      select: { nombreCompleto: true, dni: true },
    });
    if (!afiliado) throw new NotFoundException('Afiliado no encontrado');

    const prestador = await this.prisma.prestador.findUnique({
      where: { id: dto.prestadorId },
      select: { nombre: true },
    });
    if (!prestador) throw new NotFoundException('Prestador no encontrado');

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // default 7 días

    return this.prisma.bonoAtencion.create({
      data: {
        code,

        afiliadoId: dto.afiliadoId,
        prestadorId: dto.prestadorId,

        turnoId: dto.turnoId ?? null,

        afiliadoNombreSnap: afiliado.nombreCompleto,
        afiliadoDniSnap: afiliado.dni,
        prestadorNombreSnap: prestador.nombre,

        practica: dto.practica.trim(),
        observaciones: dto.observaciones?.trim() || null,
        fechaAtencionISO: dto.fechaAtencionISO ?? null,

        expiresAt,

        createdByUserId,
      },
      select: {
        id: true,
        code: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        afiliadoNombreSnap: true,
        afiliadoDniSnap: true,
        prestadorNombreSnap: true,
        practica: true,
        observaciones: true,
        fechaAtencionISO: true,
      },
    });
  }

  async verificar(
    codeRaw: string,
    token: string | undefined,
    meta: VerifyMeta,
  ) {
    const code = String(codeRaw ?? '').trim();
    if (!code) throw new BadRequestException('code requerido');

    // ✅ resolvemos prestadorId si vino prestadorUserId (sub)
    const prestadorId = meta.prestadorUserId
      ? await this.resolvePrestadorIdByUserId(meta.prestadorUserId)
      : undefined;

    const bono = await this.prisma.bonoAtencion.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        status: true,
        issuedAt: true,
        expiresAt: true,
        usedAt: true,
        practica: true,
        observaciones: true,
        fechaAtencionISO: true,
        afiliadoNombreSnap: true,
        afiliadoDniSnap: true,
        prestadorNombreSnap: true,
        prestadorId: true,
        usedByPrestadorId: true,
      },
    });

    // log scan NOT_FOUND
    if (!bono) {
      await this.createScan(null, {
        prestadorId,
        ip: meta.ip,
        userAgent: meta.userAgent,
        result: BonoScanResult.NOT_FOUND,
      });
      return { ok: false, status: 'NOT_FOUND' as const };
    }

    const now = Date.now();
    let result: BonoScanResult = BonoScanResult.VALID;

    if (bono.status === BonoStatus.CANCELLED) result = BonoScanResult.CANCELLED;
    else if (bono.status === BonoStatus.USED) result = BonoScanResult.USED;
    else if (bono.expiresAt.getTime() < now) result = BonoScanResult.EXPIRED;

    await this.createScan(bono.id, {
      prestadorId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      result,
    });

    return {
      ok: result === BonoScanResult.VALID,
      status: bono.status,
      result,
      bono: {
        code: bono.code,
        afiliadoNombre: bono.afiliadoNombreSnap,
        afiliadoDni: bono.afiliadoDniSnap,
        prestadorNombre: bono.prestadorNombreSnap,
        practica: bono.practica,
        observaciones: bono.observaciones,
        fechaAtencionISO: bono.fechaAtencionISO,
        issuedAt: bono.issuedAt,
        expiresAt: bono.expiresAt,
        usedAt: bono.usedAt,
      },
    };
  }

  async usar(codeRaw: string, prestadorUserId: string) {
    const code = String(codeRaw ?? '').trim();
    if (!code) throw new BadRequestException('code requerido');

    const prestadorId = await this.resolvePrestadorIdByUserId(prestadorUserId);

    const bono = await this.prisma.bonoAtencion.findUnique({
      where: { code },
      select: { id: true, status: true, expiresAt: true, prestadorId: true },
    });
    if (!bono) throw new NotFoundException('Bono no encontrado');

    if (bono.prestadorId !== prestadorId) {
      throw new BadRequestException('Este bono no corresponde a tu prestador');
    }

    if (bono.status === BonoStatus.CANCELLED)
      throw new BadRequestException('Bono cancelado');
    if (bono.status === BonoStatus.USED)
      throw new BadRequestException('Bono ya usado');
    if (bono.expiresAt.getTime() < Date.now())
      throw new BadRequestException('Bono vencido');

    return this.prisma.bonoAtencion.update({
      where: { id: bono.id },
      data: {
        status: BonoStatus.USED,
        usedAt: new Date(),
        usedByPrestadorId: prestadorId,
      },
      select: {
        id: true,
        code: true,
        status: true,
        usedAt: true,
      },
    });
  }

  // ========= helpers =========

  private async resolvePrestadorIdByUserId(userId: string): Promise<string> {
    const p = await this.prisma.prestador.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!p)
      throw new BadRequestException('El usuario no tiene perfil de prestador');
    return p.id;
  }

  private async createScan(
    bonoId: string | null,
    input: {
      prestadorId?: string;
      ip?: string;
      userAgent?: string;
      result: BonoScanResult;
    },
  ) {
    // Si no hay bonoId (NOT_FOUND), no podemos linkear scan a bono (FK).
    // En ese caso, simplemente no creamos scan. Si querés log global, hacemos tabla aparte.
    if (!bonoId) return;

    await this.prisma.bonoAtencionScan.create({
      data: {
        bonoId,
        prestadorId: input.prestadorId ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        result: input.result,
      },
    });
  }

  private async generateUniqueCode(): Promise<string> {
    // MED-XXXXXX (6 dígitos)
    for (let i = 0; i < 10; i++) {
      const n = Math.floor(Math.random() * 1_000_000);
      const code = `MED-${String(n).padStart(6, '0')}`;
      const exists = await this.prisma.bonoAtencion.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    // fallback ultra raro
    return `MED-${Date.now()}`;
  }
}
