import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListAdicionalesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  empresa?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from inválido (YYYY-MM-DD)' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to inválido (YYYY-MM-DD)' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  take?: number;
}

export type CreateAdicionalDto = {
  empresa: string;
  nroAfiliado?: string | null;
  nombre: string;
  dni: string;
  adicional: string;
  fechaISO: string; // YYYY-MM-DD
};
