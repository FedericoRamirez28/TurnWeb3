// apps/backend-taller/src/modules/calendario/calendario.controller.ts

import { Controller, Get, Param, Query } from '@nestjs/common'
import { CalendarioService } from './calendario.service'

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

@Controller('moviles')
export class CalendarioController {
  constructor(private readonly svc: CalendarioService) {}

  @Get(':id/calendario')
  async calendario(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<ApiResult<any[]>> {
    try {
      const data = await this.svc.getCalendario(id, { from, to })
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  // ✅ NUEVO: detalle del día (para modal lectura)
  @Get(':id/calendario/dia')
  async detalleDia(@Param('id') id: string, @Query('fecha') fecha: string): Promise<ApiResult<any>> {
    try {
      const data = await this.svc.getDetalleDia(id, fecha)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }
}
