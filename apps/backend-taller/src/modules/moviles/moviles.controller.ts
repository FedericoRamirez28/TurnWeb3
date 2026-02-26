import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { MovilesService } from './moviles.service'

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }
type Prioridad = 'baja' | 'alta' | 'urgente'

@Controller('moviles')
export class MovilesController {
  constructor(private readonly svc: MovilesService) {}

  @Get('info-map')
  async infoMap(): Promise<ApiResult<Record<string, string>>> {
    try {
      const data = await this.svc.getInfoMap()
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Get('prioridades-map')
  async prioridadesMap(): Promise<ApiResult<Record<string, Prioridad>>> {
    try {
      const data = await this.svc.getPrioridadesMap()
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Get(':id/info')
  async info(@Param('id') id: string): Promise<ApiResult<{ patente_fija: string | null }>> {
    try {
      const data = await this.svc.getInfo(id)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Get(':id/parte-diario/ultimo')
  async ultimoParte(@Param('id') id: string): Promise<ApiResult<any>> {
    try {
      const data = await this.svc.getUltimoParte(id)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Post(':id/parte-diario')
  async crearParte(
    @Param('id') id: string,
    @Body()
    body: {
      fechaISO?: string | null
      chofer?: string | null
      km_inicio?: number | string | null
      km_fin?: number | string | null
    },
  ): Promise<ApiResult<any>> {
    try {
      const data = await this.svc.createParteDiario(id, body || {})
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Get(':id/km-acumulado')
  async kmAcum(@Param('id') id: string): Promise<ApiResult<{ kmAcum: number }>> {
    try {
      const data = await this.svc.getKmAcumulado(id)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Get(':id/vtv')
  async getVtv(@Param('id') id: string): Promise<ApiResult<{ fecha: string | null }>> {
    try {
      const data = await this.svc.getVtv(id)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Put(':id/vtv')
  async putVtv(@Param('id') id: string, @Body() body: { fecha: string | null }): Promise<ApiResult<{ ok: true }>> {
    try {
      const data = await this.svc.putVtv(id, body?.fecha ?? null)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  /* ===========================
     ✅ CALENDARIO (PERSISTENTE)
     =========================== */

  // GET /moviles/:id/calendario?from=YYYY-MM-DD&to=YYYY-MM-DD
  @Get(':id/calendario')
  async calendario(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ApiResult<any>> {
    try {
      const data = await this.svc.getCalendarioEventos(id, { from, to })
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  // GET /moviles/:id/calendario/dia?fecha=YYYY-MM-DD
  @Get(':id/calendario/dia')
  async calendarioDia(@Param('id') id: string, @Query('fecha') fecha?: string): Promise<ApiResult<any>> {
    try {
      const data = await this.svc.getCalendarioDiaDetalle(id, fecha)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }
}
