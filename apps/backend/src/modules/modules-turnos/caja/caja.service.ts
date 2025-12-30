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

  // ✅ monto "efectivo" (lo que suma a caja)
  monto: number;

  // ✅ NUEVO: Mercado Pago (NO suma al total)
  mpPagado?: boolean;
  mpMonto?: number;
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

/* ===================== SAFE READ HELPERS (JSON) ===================== */

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function readBool(v: unknown, key: string, fallback = false): boolean {
  const rec = asRecord(v);
  const x = rec[key];
  return typeof x === 'boolean' ? x : fallback;
}

function readNumber(v: unknown, key: string, fallback = 0): number {
  const rec = asRecord(v);
  const x = rec[key];
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string') {
    const n = Number(x.replace(',', '.'));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function readString(v: unknown, key: string, fallback = ''): string {
  const rec = asRecord(v);
  const x = rec[key];
  return typeof x === 'string' ? x : fallback;
}

/* ===================== SERVICE ===================== */

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

    const rows: CajaRowDto[] = turnos.map((t) => {
      // ✅ si en tu tabla Turno agregaste mpPagado/mpMonto/mpRef, Prisma te los expone acá.
      // Si todavía NO están en el schema, comentá estas 3 líneas hasta migrar.
      const mpPagado = Boolean(
        (t as unknown as Record<string, unknown>).mpPagado,
      );
      const mpMonto = Number(
        (t as unknown as Record<string, unknown>).mpMonto ?? 0,
      );
      const mpRef =
        ((t as unknown as Record<string, unknown>).mpRef as
          | string
          | undefined) ?? null;

      // ✅ Caja SOLO efectivo
      const montoEfectivo = mpPagado ? 0 : Number(t.monto ?? 0);

      return {
        fecha: this.isoToDisplay(fechaISO),
        numeroAfiliado: t.afiliado?.numeroAfiliado ?? '',
        dni: t.afiliado?.dni ?? '',
        nombreCompleto: t.afiliado?.nombreCompleto ?? '',
        prestador: t.prestador ?? '',
        especialidadOLaboratorio:
          t.laboratorio ?? t.especialidad ?? t.tipoAtencion ?? '',
        monto: montoEfectivo,
        mpPagado,
        mpMonto,
        mpRef,
      };
    });

    // ✅ total SOLO efectivo
    const total = rows.reduce((acc, r) => acc + Number(r.monto ?? 0), 0);
    return { fechaISO, total, rows };
  }

  /* ===================== PERSIST / READ ===================== */

  private mapPersistedRows(rowsUnknown: unknown): CajaRowDto[] {
    if (!Array.isArray(rowsUnknown)) return [];

    return rowsUnknown.map((r) => {
      // ✅ lectura segura (SIN any)
      const mpPagado = readBool(r, 'mpPagado', false);
      const mpMonto = readNumber(r, 'mpMonto', 0);
      const mpRef = readString(r, 'mpRef', '');

      const monto = readNumber(r, 'monto', 0);

      return {
        fecha: readString(r, 'fecha', '—'),
        numeroAfiliado: readString(r, 'numeroAfiliado', '—'),
        dni: readString(r, 'dni', '—'),
        nombreCompleto: readString(r, 'nombreCompleto', '—'),
        prestador: readString(r, 'prestador', '—'),
        especialidadOLaboratorio: readString(
          r,
          'especialidadOLaboratorio',
          '—',
        ),
        monto,
        mpPagado,
        mpMonto,
        mpRef: mpRef || null,
      };
    });
  }

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

    const historial = historialDb.map((h) => ({
      fechaISO: h.fechaISO,
      total: Number(h.total ?? 0),
    }));

    return { hoyFechaISO, hoy, ayerFechaISO, ayer, historial };
  }
}
