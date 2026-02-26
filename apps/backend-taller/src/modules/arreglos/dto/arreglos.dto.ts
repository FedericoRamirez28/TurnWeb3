import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

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

  // ✅ el frontend a veces usa "fecha", a veces "fechaISO"
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TareaDto)
  tareas?: TareaDto[]
}
