import { Injectable, NotFoundException } from '@nestjs/common';
import { Afiliado, Turno } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

export type AfiliadoDto = {
  id: string;
  numeroAfiliado: string;
  dni: string;
  nombreCompleto: string;

  domicilio: string;
  localidad: string;
  codigoPostal: string;
  partido: string;
  provincia: string;

  telefono: string;
  telefonoAlt?: string;
  email: string;
  fechaNacimiento: string;
  esTitular: boolean;
  plan: string;

  proximoTurno?: string | null;
};

export type CreateOrUpdateAfiliadoInput = {
  numeroAfiliado: string;
  dni: string;
  nombreCompleto: string;
  domicilio: string;
  localidad: string;
  codigoPostal: string;
  partido: string;
  provincia: string;
  telefono1: string;
  telefono2?: string;
  email: string;
  fechaNacimiento: string;
  esTitular: boolean;
  plan: string;
};

type TurnoHistorialDto = {
  id: string;
  date: string;
  turnoDate: string;
  time: string;
  estado: string;
  tipoAtencion: string;
  especialidad?: string | null;
  laboratorio?: string | null;
  profesional: string;
  prestador: string;
  plan?: string | null;
  monto: number;
};

@Injectable()
export class AfiliadosService {
  constructor(private readonly prisma: PrismaService) {}

  // ====== MAPEOS ======

  private mapAfiliado(row: Afiliado): AfiliadoDto {
    return {
      id: row.id,
      numeroAfiliado: row.numeroAfiliado,
      dni: row.dni,
      nombreCompleto: row.nombreCompleto,

      domicilio: row.domicilio ?? '',
      localidad: row.localidad ?? '',
      codigoPostal: row.codigoPostal ?? '',
      partido: row.partido ?? '',
      provincia: row.provincia ?? '',

      telefono: row.telefono ?? '',
      telefonoAlt: row.telefonoAlt ?? '',
      email: row.email ?? '',
      fechaNacimiento: row.fechaNacimiento
        ? row.fechaNacimiento.toISOString().slice(0, 10)
        : '',
      esTitular: row.esTitular,
      plan: row.plan ?? '',
      proximoTurno: null,
    };
  }

  private mapTurnoToHistorial(turno: Turno): TurnoHistorialDto {
    const fechaTomado = turno.fechaTomado.toISOString().slice(0, 10);
    const fechaReal = (turno.fechaReal ?? turno.fechaTomado)
      .toISOString()
      .slice(0, 10);

    return {
      id: turno.id,
      date: fechaTomado,
      turnoDate: fechaReal,
      time: turno.hora,
      estado: turno.estado,
      tipoAtencion: turno.tipoAtencion,
      especialidad: turno.especialidad,
      laboratorio: turno.laboratorio,
      profesional: turno.profesional,
      prestador: turno.prestador,
      plan: turno.plan,
      monto: turno.monto,
    };
  }

  // ====== MÉTODOS PÚBLICOS ======

  async findAll(): Promise<AfiliadoDto[]> {
    const rows = await this.prisma.afiliado.findMany({
      where: { activo: true },
      orderBy: { nombreCompleto: 'asc' },
    });
    return rows.map((r) => this.mapAfiliado(r));
  }

  async create(input: CreateOrUpdateAfiliadoInput): Promise<AfiliadoDto> {
    const fechaNacimiento =
      input.fechaNacimiento && input.fechaNacimiento.trim().length > 0
        ? new Date(input.fechaNacimiento)
        : null;

    const created = await this.prisma.afiliado.create({
      data: {
        numeroAfiliado: input.numeroAfiliado,
        dni: input.dni,
        nombreCompleto: input.nombreCompleto,
        domicilio: input.domicilio || null,
        localidad: input.localidad || null,
        codigoPostal: input.codigoPostal || null,
        partido: input.partido || null,
        provincia: input.provincia || null,
        telefono: input.telefono1 || null,
        telefonoAlt: input.telefono2 || null,
        email: input.email || null,
        fechaNacimiento,
        esTitular: input.esTitular,
        plan: input.plan || null,
      },
    });

    return this.mapAfiliado(created);
  }

  async update(
    id: string,
    input: CreateOrUpdateAfiliadoInput,
  ): Promise<AfiliadoDto> {
    const existing = await this.prisma.afiliado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Afiliado no encontrado');

    const fechaNacimiento =
      input.fechaNacimiento && input.fechaNacimiento.trim().length > 0
        ? new Date(input.fechaNacimiento)
        : null;

    const updated = await this.prisma.afiliado.update({
      where: { id },
      data: {
        numeroAfiliado: input.numeroAfiliado,
        dni: input.dni,
        nombreCompleto: input.nombreCompleto,
        domicilio: input.domicilio || null,
        localidad: input.localidad || null,
        codigoPostal: input.codigoPostal || null,
        partido: input.partido || null,
        provincia: input.provincia || null,
        telefono: input.telefono1 || null,
        telefonoAlt: input.telefono2 || null,
        email: input.email || null,
        fechaNacimiento,
        esTitular: input.esTitular,
        plan: input.plan || null,
      },
    });

    return this.mapAfiliado(updated);
  }

  async getHistorial(afiliadoId: string): Promise<TurnoHistorialDto[]> {
    const turnos = await this.prisma.turno.findMany({
      where: { afiliadoId },
      orderBy: { fechaTomado: 'asc' },
    });

    return turnos.map((t) => this.mapTurnoToHistorial(t));
  }

  async darDeBaja(id: string): Promise<AfiliadoDto> {
    const existing = await this.prisma.afiliado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Afiliado no encontrado');

    const updated = await this.prisma.afiliado.update({
      where: { id },
      data: { activo: false },
    });

    return this.mapAfiliado(updated);
  }
}
