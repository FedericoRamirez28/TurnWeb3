// apps/backend/src/modules/laboral/consultorios/consultorios.dto.ts
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ListConsultoriosQueryDto {
  @IsOptional()
  @IsString()
  @Matches(ISO_DAY_RE, { message: 'from inválido (YYYY-MM-DD)' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DAY_RE, { message: 'to inválido (YYYY-MM-DD)' })
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  take?: string;
}

export class CreateConsultorioTurnoDto {
  @IsString()
  companyId!: string;

  @IsString()
  @MaxLength(32)
  dni!: string;

  @IsString()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @Matches(ISO_DAY_RE, { message: 'nacimientoISO inválido (YYYY-MM-DD)' })
  nacimientoISO?: string;

  @IsString()
  @MaxLength(180)
  motivo!: string;

  @IsString()
  @MaxLength(4000)
  diagnostico!: string;

  @IsString()
  @Matches(ISO_DAY_RE, { message: 'fechaTurnoISO inválida (YYYY-MM-DD)' })
  fechaTurnoISO!: string;
}

export type ConsultorioTurnoResponse = {
  id: string;
  empresaId: string;
  empresaNombre: string;

  dni: string;
  nombre: string;
  nacimientoISO: string | null;
  motivo: string;
  diagnostico: string;

  fechaTurnoISO: string;
  createdAt: string;
};
