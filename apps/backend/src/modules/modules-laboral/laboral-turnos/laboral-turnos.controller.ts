import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
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

  // ✅ NUEVO
  horaTurno: string; // HH:mm
};

@Controller('laboral/turnos')
export class LaboralTurnosController {
  constructor(private service: LaboralTurnosService) {}

  @Post()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(@Body() dto: CreateLaboralTurnoDto, @Req() req: Request) {
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
}
