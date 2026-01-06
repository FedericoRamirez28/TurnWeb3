import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import type { Request } from 'express';
import { LaboralTurnosService } from './laboral-turnos.service';

type CreateLaboralTurnoDto = {
  sede: 'caba' | 'sanjusto';
  empresa: string;
  nombre: string;
  dni: string;
  nroAfiliado?: string;
  puesto: string;
  tipoExamen: string;
  fechaRecepcionISO: string;
  fechaTurnoISO: string;
  horaTurno: string; // HH:mm
};

@Controller('laboral/turnos')
export class LaboralTurnosController {
  constructor(private service: LaboralTurnosService) {}

  @Post()
  async create(@Body() dto: CreateLaboralTurnoDto) {
    const createdByUserId = undefined;
    return this.service.create(dto, createdByUserId);
  }

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('month') month?: string,
  ) {
    return this.service.list({ q, from, to, month });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
