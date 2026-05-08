import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { FinalizadosService } from './finalizados.service'

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

@Controller('finalizados')
export class FinalizadosController {
  constructor(private readonly svc: FinalizadosService) {}

  // ✅ GET /finalizados?movilId=10
  @Get()
  async list(@Query('movilId') movilId?: string): Promise<ApiResult<any[]>> {
    try {
      const data = await this.svc.list(movilId ? String(movilId) : null)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  // ✅ POST /finalizados { arreglos: [...], movilId }
  @Post()
  async finalizar(
    @Body() body: { movilId: string; arreglos: any[] },
  ): Promise<ApiResult<{ ok: true }>> {
    try {
      const data = await this.svc.finalizar(String(body?.movilId || ''), body?.arreglos || [])
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }
}
