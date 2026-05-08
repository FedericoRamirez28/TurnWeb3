import { Body, Controller, Get, Param, Post, Put, Patch } from '@nestjs/common';
import type {
  AfiliadoDto,
  CreateOrUpdateAfiliadoInput,
} from './afiliados.service';
import { AfiliadosService } from './afiliados.service';

@Controller('afiliados')
export class AfiliadosController {
  constructor(private readonly afiliadosService: AfiliadosService) {}

  @Get()
  getAll(): Promise<AfiliadoDto[]> {
    return this.afiliadosService.findAll();
  }

  @Post()
  create(@Body() body: CreateOrUpdateAfiliadoInput): Promise<AfiliadoDto> {
    return this.afiliadosService.create(body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: CreateOrUpdateAfiliadoInput,
  ): Promise<AfiliadoDto> {
    return this.afiliadosService.update(id, body);
  }

  @Patch(':id/baja')
  darDeBaja(@Param('id') id: string): Promise<AfiliadoDto> {
    return this.afiliadosService.darDeBaja(id);
  }

  @Get(':id/historial')
  getHistorial(@Param('id') id: string) {
    return this.afiliadosService.getHistorial(id);
  }
}
