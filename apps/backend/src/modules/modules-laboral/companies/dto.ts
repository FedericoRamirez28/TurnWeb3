import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @Length(1, 160)
  nombre!: string;

  @IsOptional() @IsString() nroSocio?: string;
  @IsOptional() @IsString() cuit?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() domicilio?: string;
  @IsOptional() @IsString() notas?: string;
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() @Length(1, 160) nombre?: string;
  @IsOptional() @IsString() nroSocio?: string;
  @IsOptional() @IsString() cuit?: string;
  @IsOptional() @IsString() contacto?: string;
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() domicilio?: string;
  @IsOptional() @IsString() notas?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
