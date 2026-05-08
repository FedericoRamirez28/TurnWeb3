import { Type } from 'class-transformer'
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator'

const PRIORIDADES = ['baja', 'alta', 'urgente'] as const
export type PrioridadDto = (typeof PRIORIDADES)[number]

export class TareaDto {
  @IsString()
  texto!: string

  @IsOptional()
  completa?: boolean

  @IsOptional()
  orden?: number
}

export class CreateArregloDto {
  @IsString()
  movilId!: string

  @IsOptional()
  @IsString()
  patente?: string | null

  @IsOptional()
  @IsString()
  fechaISO?: string | null

  @IsOptional()
  @IsString()
  fecha?: string | null

  @IsOptional()
  @IsString()
  motivo?: string | null

  @IsOptional()
  @IsString()
  anotaciones?: string | null

  @IsOptional()
  @IsIn(PRIORIDADES as any)
  prioridad?: PrioridadDto

  @IsOptional()
  @IsString()
  hora_entrada?: string | null

  @IsOptional()
  @IsString()
  horaEntrada?: string | null

  @IsOptional()
  @IsString()
  hora_salida?: string | null

  @IsOptional()
  @IsString()
  horaSalida?: string | null

  @IsOptional()
  @IsBoolean()
  salida_indefinida?: boolean

  @IsOptional()
  @IsBoolean()
  salidaIndefinida?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TareaDto)
  tareas?: TareaDto[]
}

export class UpdateArregloDto {
  @IsOptional()
  @IsString()
  patente?: string | null

  @IsOptional()
  @IsString()
  fechaISO?: string | null

  @IsOptional()
  @IsString()
  fecha?: string | null

  @IsOptional()
  @IsString()
  motivo?: string | null

  @IsOptional()
  @IsString()
  anotaciones?: string | null

  @IsOptional()
  @IsIn(PRIORIDADES as any)
  prioridad?: PrioridadDto

  @IsOptional()
  @IsString()
  hora_entrada?: string | null

  @IsOptional()
  @IsString()
  horaEntrada?: string | null

  @IsOptional()
  @IsString()
  hora_salida?: string | null

  @IsOptional()
  @IsString()
  horaSalida?: string | null

  @IsOptional()
  @IsBoolean()
  salida_indefinida?: boolean

  @IsOptional()
  @IsBoolean()
  salidaIndefinida?: boolean

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TareaDto)
  tareas?: TareaDto[]
}
