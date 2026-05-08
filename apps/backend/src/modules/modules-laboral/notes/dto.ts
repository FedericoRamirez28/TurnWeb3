import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const COLORS = ['mint', 'sky', 'lilac', 'peach', 'lemon', 'stone'] as const;

export class CreateLaboralNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;

  @IsString()
  @IsIn(COLORS as unknown as string[])
  color!: string;
}

export class UpdateLaboralNoteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsString()
  @IsIn(COLORS as unknown as string[])
  color?: string;
}
