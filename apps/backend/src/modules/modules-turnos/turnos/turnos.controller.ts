import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { CreateTurnoInput, TurnoDto, TurnoEstado } from './turnos.service';
import { TurnosService } from './turnos.service';

@Controller('turnos')
export class TurnosController {
  constructor(private readonly turnosService: TurnosService) {}

  @Get()
  getAll(): Promise<TurnoDto[]> {
    return this.turnosService.findAll();
  }

  @Post()
  create(@Body() body: CreateTurnoInput): Promise<TurnoDto> {
    return this.turnosService.create(body);
  }

  @Patch(':id/estado')
  updateEstado(
    @Param('id') id: string,
    @Body() body: { estado: TurnoEstado },
  ): Promise<TurnoDto> {
    return this.turnosService.updateEstado(id, body.estado);
  }
}
