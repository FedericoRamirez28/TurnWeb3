import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Afiliado, Turno } from '@prisma/client';

export type TurnoEstado = 'pendiente' | 'tomado' | 'recepcionado' | 'cancelado';

export interface TurnoDto {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateDni?: string;
  date: string;
  controlDate?: string | null;
  time: string;
  tipoAtencion: 'especialidad' | 'laboratorio';
  especialidad?: string | null;
  laboratorio?: string | null;
  plan: string;
  prestador: string;
  monto: number;
  profesional: string;
  mpPagado: boolean;
  mpMonto: number;
  mpRef?: string | null;
  estado: TurnoEstado;
}

export interface CreateTurnoInput {
  id?: string;
  affiliateId: string;
  date: string;
  controlDate?: string;
  time: string;
  tipoAtencion: 'especialidad' | 'laboratorio';
  especialidad?: string;
  laboratorio?: string;
  plan: string;
  prestador: string;
  monto: number;
  profesional: string;
  estado: TurnoEstado;
  motivo?: string;
  mpPagado?: boolean;
  mpMonto?: number;
  mpRef?: string;
}

type TurnoWithAfiliado = Turno & { afiliado: Afiliado | null };

@Injectable()
export class TurnosService {
  constructor(private readonly prisma: PrismaService) {}

  private toISODate(date: Date | null | undefined): string | null {
    if (!date) return null;
    return date.toISOString().slice(0, 10);
  }

  private toMoneyInt(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
    }

    return 0;
  }

  private mapTurnoToDto(turno: TurnoWithAfiliado): TurnoDto {
    return {
      id: turno.id,
      affiliateId: turno.afiliadoId,
      affiliateName: turno.afiliado?.nombreCompleto ?? '',
      affiliateDni: turno.afiliado?.dni ?? undefined,
      date: this.toISODate(turno.fechaTomado) ?? '',
      controlDate: this.toISODate(turno.fechaReal),
      time: turno.hora,
      tipoAtencion: turno.tipoAtencion as 'especialidad' | 'laboratorio',
      especialidad: turno.especialidad,
      laboratorio: turno.laboratorio,
      plan: turno.plan ?? '',
      prestador: turno.prestador,
      monto: Number(turno.monto ?? 0),
      profesional: turno.profesional,
      mpPagado: Boolean(turno.mpPagado),
      mpMonto: Number(turno.mpMonto ?? 0),
      mpRef: turno.mpRef ?? null,
      estado: turno.estado as TurnoEstado,
    };
  }

  async findAll(): Promise<TurnoDto[]> {
    const rows = await this.prisma.turno.findMany({
      orderBy: [{ fechaTomado: 'asc' }, { hora: 'asc' }],
      include: { afiliado: true },
    });

    return rows.map((row) => this.mapTurnoToDto(row));
  }

  async create(input: CreateTurnoInput): Promise<TurnoDto> {
    const fechaTomado = new Date(`${input.date}T00:00:00`);
    const fechaReal = input.controlDate
      ? new Date(`${input.controlDate}T00:00:00`)
      : null;

    const montoOriginal = this.toMoneyInt(input.monto);
    const mpPagado = Boolean(input.mpPagado);
    const mpMonto = mpPagado
      ? this.toMoneyInt(input.mpMonto ?? montoOriginal)
      : 0;
    const montoEfectivo = mpPagado ? 0 : montoOriginal;

    const data = {
      afiliadoId: input.affiliateId,
      fechaTomado,
      fechaReal,
      hora: input.time,
      estado: input.estado,
      observaciones: input.motivo?.trim() ? input.motivo.trim() : null,
      tipoAtencion: input.tipoAtencion,
      especialidad:
        input.tipoAtencion === 'especialidad'
          ? (input.especialidad?.trim() ? input.especialidad.trim() : null)
          : null,
      laboratorio:
        input.tipoAtencion === 'laboratorio'
          ? (input.laboratorio?.trim() ? input.laboratorio.trim() : null)
          : null,
      plan: input.plan?.trim() ? input.plan.trim() : null,
      monto: montoEfectivo,
      profesional: input.profesional?.trim() ? input.profesional.trim() : '',
      prestador: input.prestador?.trim() ? input.prestador.trim() : '',
      mpPagado,
      mpMonto,
      mpRef: mpPagado && input.mpRef?.trim() ? input.mpRef.trim() : null,
    } as const;

    const turno = input.id
      ? await this.prisma.turno.update({
          where: { id: input.id },
          data,
          include: { afiliado: true },
        })
      : await this.prisma.turno.create({
          data,
          include: { afiliado: true },
        });

    return this.mapTurnoToDto(turno);
  }

  async updateEstado(id: string, estado: TurnoEstado): Promise<TurnoDto> {
    const turno = await this.prisma.turno.update({
      where: { id },
      data: { estado },
      include: { afiliado: true },
    });

    return this.mapTurnoToDto(turno);
  }
}
