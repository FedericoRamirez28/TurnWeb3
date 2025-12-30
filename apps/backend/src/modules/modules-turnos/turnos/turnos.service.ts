import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { Afiliado, Turno } from '@prisma/client';

export type TurnoEstado = 'pendiente' | 'tomado' | 'recepcionado' | 'cancelado';

export interface TurnoDto {
  id: string;
  affiliateId: string;
  affiliateName: string;
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

@Injectable()
export class TurnosService {
  constructor(private readonly prisma: PrismaService) {}

  private toISODate(date: Date | null | undefined): string | null {
    if (!date) return null;
    return date.toISOString().slice(0, 10);
  }

  private mapTurnoToDto(turno: Turno & { afiliado: Afiliado }): TurnoDto {
    return {
      id: turno.id,
      affiliateId: turno.afiliadoId,
      affiliateName: turno.afiliado.nombreCompleto,
      date: this.toISODate(turno.fechaTomado) ?? '',
      controlDate: this.toISODate(turno.fechaReal),
      time: turno.hora,
      tipoAtencion: turno.tipoAtencion as 'especialidad' | 'laboratorio',
      especialidad: turno.especialidad,
      laboratorio: turno.laboratorio,
      plan: turno.plan ?? '',
      prestador: turno.prestador,
      monto: turno.monto,
      profesional: turno.profesional,
      estado: turno.estado as TurnoEstado,

      // ✅ MP
      mpPagado: Boolean(turno.mpPagado),
      mpMonto: Number(turno.mpMonto ?? 0),
      mpRef: turno.mpRef ?? null,
    };
  }

  async findAll(): Promise<TurnoDto[]> {
    const rows = await this.prisma.turno.findMany({
      orderBy: { fechaTomado: 'asc' },
      include: { afiliado: true },
    });

    return rows.map((t) => this.mapTurnoToDto(t));
  }

  async create(input: CreateTurnoInput): Promise<TurnoDto> {
    const fechaTomado = new Date(`${input.date}T00:00:00`);
    const fechaReal = input.controlDate
      ? new Date(`${input.controlDate}T00:00:00`)
      : null;
    const mpPagado = Boolean(input.mpPagado);
    const mpMontoRaw = Number(input.mpMonto ?? 0);
    const mpMonto = Number.isFinite(mpMontoRaw)
      ? Math.max(0, Math.round(mpMontoRaw))
      : 0;

    // ✅ regla de negocio: si es MP, caja efectivo debe ser 0
    const montoEfectivo = mpPagado ? 0 : Number(input.monto ?? 0) || 0;

    const data = {
      afiliadoId: input.affiliateId,
      fechaTomado,
      fechaReal,
      hora: input.time,
      estado: input.estado,
      observaciones: input.motivo ?? null,
      tipoAtencion: input.tipoAtencion,
      especialidad:
        input.tipoAtencion === 'especialidad'
          ? (input.especialidad ?? null)
          : null,
      laboratorio:
        input.tipoAtencion === 'laboratorio'
          ? (input.laboratorio ?? null)
          : null,
      plan: input.plan || null,

      // ✅ efectivo
      monto: montoEfectivo,

      profesional: input.profesional,
      prestador: input.prestador,

      // ✅ MP
      mpPagado,
      mpMonto,
      mpRef: input.mpRef?.trim() ? input.mpRef.trim() : null,
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
