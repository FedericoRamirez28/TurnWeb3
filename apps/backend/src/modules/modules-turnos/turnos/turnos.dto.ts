import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import * as turnosTypes from './turnos.types';

export class CreateTurnoDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  affiliateId: string;

  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  controlDate?: string;

  @IsString()
  time: string;

  @IsIn(['especialidad', 'laboratorio'])
  tipoAtencion: 'especialidad' | 'laboratorio';

  @IsOptional()
  @IsString()
  especialidad?: string;

  @IsOptional()
  @IsString()
  laboratorio?: string;

  @IsString()
  plan: string;

  @IsString()
  prestador: string;

  @IsNumber()
  monto: number;

  @IsString()
  profesional: string;

  @IsIn(turnosTypes.APPOINTMENT_STATES)
  estado: turnosTypes.AppointmentStatus;

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsBoolean()
  mpPagado?: boolean;

  @IsOptional()
  @IsNumber()
  mpMonto?: number;

  @IsOptional()
  @IsString()
  mpRef?: string;
}

export class UpdateEstadoDto {
  @IsIn(turnosTypes.APPOINTMENT_STATES)
  estado: turnosTypes.AppointmentStatus;
}

export type AppointmentResponse = {
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
  estado: turnosTypes.AppointmentStatus;
};
