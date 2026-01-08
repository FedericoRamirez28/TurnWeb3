import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Patch,
} from '@nestjs/common';
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
  horaTurno: string;
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
    @Query('sede') sede?: 'caba' | 'sanjusto', // ✅ NUEVO
  ) {
    return this.service.list({ q, from, to, month, sede });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateLaboralTurnoDto>,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
