import { Injectable } from '@nestjs/common';
import { Prisma, Turno, Afiliado } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

/* ===================== DTOs ===================== */

export interface CajaRowDto {
  fecha: string;
  numeroAfiliado: string;
  dni: string;
  nombreCompleto: string;
  prestador: string;
  especialidadOLaboratorio: string;
  monto: number;
}

export interface CierreCajaDto {
  fechaISO: string;
  total: number;
  rows: CajaRowDto[];
}

export interface CajaEstadoDto {
  hoyFechaISO: string;
  hoy: CierreCajaDto;
  ayerFechaISO: string;
  ayer: CierreCajaDto;
  historial: { fechaISO: string; total: number }[];
}

type TurnoWithAfiliado = Turno & { afiliado: Afiliado | null };

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

  /* ===================== HELPERS ===================== */

  private getCajaDateForNow(now: Date = new Date()): string {
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (now.getHours() >= 18) base.setDate(base.getDate() + 1);
    return base.toISOString().slice(0, 10);
  }

  private addDays(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private isoToDisplay(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  private buildIntervalForCajaDate(fechaISO: string) {
    const [y, m, d] = fechaISO.split('-').map(Number);
    const end = new Date(y, m - 1, d, 18, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 1);
    return { start, end };
  }

  /* ===================== CORE ===================== */

  private async buildCajaForDate(fechaISO: string): Promise<CierreCajaDto> {
    const { start, end } = this.buildIntervalForCajaDate(fechaISO);

    const turnos = (await this.prisma.turno.findMany({
      where: {
        estado: 'recepcionado',
        updatedAt: { gte: start, lt: end },
      },
      include: { afiliado: true },
      orderBy: { updatedAt: 'asc' },
    })) as TurnoWithAfiliado[];

    const rows: CajaRowDto[] = turnos.map((t) => ({
      fecha: this.isoToDisplay(fechaISO),
      numeroAfiliado: t.afiliado?.numeroAfiliado ?? '',
      dni: t.afiliado?.dni ?? '',
      nombreCompleto: t.afiliado?.nombreCompleto ?? '',
      prestador: t.prestador ?? '',
      especialidadOLaboratorio:
        t.laboratorio ?? t.especialidad ?? t.tipoAtencion ?? '',
      monto: Number(t.monto ?? 0),
    }));

    const total = rows.reduce((acc, r) => acc + r.monto, 0);
    return { fechaISO, total, rows };
  }

  /* ===================== PERSIST / READ ===================== */

  private async getCajaPersistedOrLive(
    fechaISO: string,
  ): Promise<CierreCajaDto> {
    const saved = await this.prisma.cierreCaja.findUnique({
      where: { fechaISO },
    });

    if (saved) {
      return {
        fechaISO: saved.fechaISO,
        total: Number(saved.total ?? 0),
        rows: (saved.rows as unknown as CajaRowDto[]) ?? [],
      };
    }

    return this.buildCajaForDate(fechaISO);
  }
  async cerrarCaja(fechaISO?: string): Promise<CierreCajaDto> {
    const targetISO = fechaISO || this.getCajaDateForNow();
    const caja = await this.buildCajaForDate(targetISO);

    await this.prisma.cierreCaja.upsert({
      where: { fechaISO: targetISO },
      update: {
        total: caja.total,
        rows: caja.rows as unknown as Prisma.InputJsonValue,
      },
      create: {
        fechaISO: targetISO,
        total: caja.total,
        rows: caja.rows as unknown as Prisma.InputJsonValue,
      },
    });

    return caja;
  }

  async getCajaByDate(fechaISO: string): Promise<CierreCajaDto> {
    return this.getCajaPersistedOrLive(fechaISO);
  }

  async getEstadoCaja(): Promise<CajaEstadoDto> {
    const hoyFechaISO = this.getCajaDateForNow();
    const ayerFechaISO = this.addDays(hoyFechaISO, -1);

    const [hoy, ayer] = await Promise.all([
      this.getCajaPersistedOrLive(hoyFechaISO),
      this.getCajaPersistedOrLive(ayerFechaISO),
    ]);

    const historialDb = await this.prisma.cierreCaja.findMany({
      select: { fechaISO: true, total: true },
      orderBy: { fechaISO: 'desc' },
      take: 120,
    });

    const historial = historialDb.map((h) => ({
      fechaISO: h.fechaISO,
      total: Number(h.total ?? 0),
    }));

    return { hoyFechaISO, hoy, ayerFechaISO, ayer, historial };
  }
}
