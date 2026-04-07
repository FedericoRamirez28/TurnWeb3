import { Injectable } from '@nestjs/common';
import { Prisma, Turno, Afiliado } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CajaRowDto {
  fecha: string;
  numeroAfiliado: string;
  dni: string;
  nombreCompleto: string;
  prestador: string;
  especialidadOLaboratorio: string;
  monto: number;
  mpPagado: boolean;
  mpMonto: number;
  mpRef?: string | null;
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function readBool(value: unknown, key: string, fallback = false): boolean {
  const record = asRecord(value);
  const found = record[key];
  return typeof found === 'boolean' ? found : fallback;
}

function readNumber(value: unknown, key: string, fallback = 0): number {
  const record = asRecord(value);
  const found = record[key];

  if (typeof found === 'number' && Number.isFinite(found)) return found;
  if (typeof found === 'string') {
    const parsed = Number(found.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function readString(value: unknown, key: string, fallback = ''): string {
  const record = asRecord(value);
  const found = record[key];
  return typeof found === 'string' ? found : fallback;
}

@Injectable()
export class CajaService {
  constructor(private readonly prisma: PrismaService) {}

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

  private mapTurnoToCajaRow(fechaISO: string, turno: TurnoWithAfiliado): CajaRowDto {
    const mpPagado = Boolean(turno.mpPagado);
    const mpMonto = Number(turno.mpMonto ?? 0);
    const montoEfectivo = mpPagado ? 0 : Number(turno.monto ?? 0);

    return {
      fecha: this.isoToDisplay(fechaISO),
      numeroAfiliado: turno.afiliado?.numeroAfiliado ?? '',
      dni: turno.afiliado?.dni ?? '',
      nombreCompleto: turno.afiliado?.nombreCompleto ?? '',
      prestador: turno.prestador ?? '',
      especialidadOLaboratorio:
        turno.laboratorio ?? turno.especialidad ?? turno.tipoAtencion ?? '',
      monto: montoEfectivo,
      mpPagado,
      mpMonto,
      mpRef: turno.mpRef ?? null,
    };
  }

  private async buildCajaForDate(fechaISO: string): Promise<CierreCajaDto> {
    const { start, end } = this.buildIntervalForCajaDate(fechaISO);

    const turnos = await this.prisma.turno.findMany({
      where: {
        estado: 'recepcionado',
        updatedAt: { gte: start, lt: end },
      },
      include: { afiliado: true },
      orderBy: [{ updatedAt: 'asc' }, { hora: 'asc' }],
    });

    const rows = turnos.map((turno) => this.mapTurnoToCajaRow(fechaISO, turno));
    const total = rows.reduce((acc, row) => acc + Number(row.monto ?? 0), 0);

    return { fechaISO, total, rows };
  }

  private mapPersistedRows(rowsUnknown: unknown): CajaRowDto[] {
    if (!Array.isArray(rowsUnknown)) return [];

    return rowsUnknown.map((row) => ({
      fecha: readString(row, 'fecha', '—'),
      numeroAfiliado: readString(row, 'numeroAfiliado', '—'),
      dni: readString(row, 'dni', '—'),
      nombreCompleto: readString(row, 'nombreCompleto', '—'),
      prestador: readString(row, 'prestador', '—'),
      especialidadOLaboratorio: readString(row, 'especialidadOLaboratorio', '—'),
      monto: readNumber(row, 'monto', 0),
      mpPagado: readBool(row, 'mpPagado', false),
      mpMonto: readNumber(row, 'mpMonto', 0),
      mpRef: readString(row, 'mpRef', '') || null,
    }));
  }

  private async getCajaPersistedOrLive(fechaISO: string): Promise<CierreCajaDto> {
    const saved = await this.prisma.cierreCaja.findUnique({
      where: { fechaISO },
    });

    if (saved) {
      return {
        fechaISO: saved.fechaISO,
        total: Number(saved.total ?? 0),
        rows: this.mapPersistedRows(saved.rows),
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

    const historial = historialDb.map((item) => ({
      fechaISO: item.fechaISO,
      total: Number(item.total ?? 0),
    }));

    return { hoyFechaISO, hoy, ayerFechaISO, ayer, historial };
  }
}
