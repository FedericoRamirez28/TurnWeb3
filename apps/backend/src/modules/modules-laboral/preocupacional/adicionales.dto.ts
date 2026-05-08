import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAdicionalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  empresa!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nroAfiliado?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  dni!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  adicional!: string;

  // YYYY-MM-DD (ISO day). Usamos IsISO8601 con opción "strict" en formato full ISO?
  // Para day-only, validamos como string y luego chequeamos regex en service si querés.
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  fechaISO!: string;
}

export class CreateAdicionalesBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAdicionalDto)
  items!: CreateAdicionalDto[];
}

export class ListAdicionalesQueryDto {
  @IsOptional()
  @IsString()
  from?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  to?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  q?: string; // search text

  @IsOptional()
  @IsString()
  empresa?: string;
}
