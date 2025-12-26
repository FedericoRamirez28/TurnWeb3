import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListPortadasQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  take?: number;
}

export class CreateOrUpdatePortadaDto {
  @IsString()
  apellidoNombre!: string;

  @IsString()
  dni!: string;

  @IsOptional()
  @IsString()
  nroSocio?: string | null;

  @IsOptional()
  @IsString()
  domicilio?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fechaNacimiento inválida (YYYY-MM-DD)',
  })
  fechaNacimiento?: string | null;
}
