import { Controller, Get, Post, Query, Param } from '@nestjs/common';
import {
  CajaService,
  type CajaEstadoDto,
  type CierreCajaDto,
} from './caja.service';

@Controller('caja')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}

  @Get('estado')
  async getEstado(): Promise<CajaEstadoDto> {
    return this.cajaService.getEstadoCaja();
  }

  @Post('cerrar')
  async cerrarCaja(@Query('date') dateISO?: string): Promise<CierreCajaDto> {
    return this.cajaService.cerrarCaja(dateISO);
  }

  @Get(':fechaISO')
  async getCajaByDate(
    @Param('fechaISO') fechaISO: string,
  ): Promise<CierreCajaDto> {
    return this.cajaService.getCajaByDate(fechaISO);
  }
}
