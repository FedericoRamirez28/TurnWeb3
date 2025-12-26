import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';
import * as turnosTypes from './turnos.types';

export class CreateTurnoDto {
  @IsString()
  affiliateId: string;

  @IsString()
  affiliateName: string;

  @IsString()
  @IsOptional()
  affiliateDni?: string;

  @IsString()
  date: string;

  @IsString()
  @IsOptional()
  controlDate?: string;

  @IsString()
  time: string;

  @IsIn(['especialidad', 'laboratorio'])
  tipoAtencion: 'especialidad' | 'laboratorio';

  @IsString()
  @IsOptional()
  especialidad?: string;

  @IsString()
  @IsOptional()
  laboratorio?: string;

  @IsString()
  plan: string;

  @IsString()
  prestador: string;

  @IsNumber()
  monto: number;

  @IsString()
  profesional: string;
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
  controlDate?: string;
  time: string;

  tipoAtencion: 'especialidad' | 'laboratorio';
  especialidad?: string;
  laboratorio?: string;

  plan: string;
  prestador: string;
  monto: number;
  profesional: string;

  estado: turnosTypes.AppointmentStatus;
};
