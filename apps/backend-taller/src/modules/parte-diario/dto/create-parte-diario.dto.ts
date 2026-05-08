import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateParteDiarioDto {
  @IsString()
  patente!: string

  @IsString()
  chofer!: string

  @IsInt()
  @Min(0)
  km_inicio!: number

  @IsInt()
  @Min(0)
  km_fin!: number

  @IsOptional()
  @IsString()
  observaciones?: string

  // opcional: si querés proteger el endpoint
  @IsOptional()
  @IsString()
  pd_key?: string

  // opcional: si algún día querés mandar fecha manual
  @IsOptional()
  @IsString()
  fecha?: string // YYYY-MM-DD
}
