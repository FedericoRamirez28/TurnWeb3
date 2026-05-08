import { Controller, Get, Query } from '@nestjs/common'
import { HistorialService } from './historial.service'

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

@Controller('historial')
export class HistorialController {
  constructor(private readonly svc: HistorialService) {}

  // ✅ GET /historial?movilId=10 (opcional)
  @Get()
  async list(@Query('movilId') movilId?: string): Promise<ApiResult<any[]>> {
    try {
      const data = await this.svc.listResumen(movilId ? String(movilId) : null)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }
}
