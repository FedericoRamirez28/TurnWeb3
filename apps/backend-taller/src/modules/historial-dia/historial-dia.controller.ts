import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common'
import { HistorialDiaService } from './historial-dia.service'

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

@Controller('historial-dia')
export class HistorialDiaController {
  constructor(private readonly svc: HistorialDiaService) {}

  /**
   * ✅ /historial-dia?fecha=YYYY-MM-DD&movilId=10
   * ✅ /historial-dia?fecha=YYYY-MM-DD&movil_id=10
   * ✅ /historial-dia?fecha=YYYY-MM-DD        -> GLOBAL (todos)
   */
  @Get()
  async list(
    @Query('fecha') fecha?: string,
    @Query('movilId') movilIdA?: string,
    @Query('movil_id') movilIdB?: string,
  ): Promise<ApiResult<any[]>> {
    try {
      const f = String(fecha || '').trim()
      const movilRaw = String(movilIdA || movilIdB || '').trim()

      if (!f) return { ok: true, data: [] }

      const data = movilRaw ? await this.svc.listByMovil(movilRaw, f) : await this.svc.listAll(f)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Post()
  async upsertFromPayload(@Body() body: Record<string, unknown>): Promise<ApiResult<{ ok: true }>> {
    try {
      const data = await this.svc.upsertFromPayload({
        fechaISO: String(body?.fechaISO ?? body?.fecha ?? '').trim() || null,
        movilId: String(body?.movil_id ?? body?.movilId ?? '').trim() || null,
        arregloId: String(body?.arreglo_id ?? body?.arregloId ?? '').trim() || null,
        horaEntrada: (body?.hora_entrada ?? body?.horaEntrada ?? null) as string | null,
        horaSalida: (body?.hora_salida ?? body?.horaSalida ?? null) as string | null,
        salidaIndefinida: !!(body?.salida_indefinida ?? body?.salidaIndefinida),
        patente: String(body?.patente ?? '').trim() || null,
        motivo: String(body?.motivo ?? '').trim() || null,
        prioridad: String(body?.prioridad ?? '').trim() || null,
        anotaciones: String(body?.anotaciones ?? '').trim() || null,
        payload: body?.payload,
      })

      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  // ✅ lo usa KanbanBoard
  @Put('update-by-arreglo-id')
  async updateByArregloId(
    @Body()
    body: {
      arreglo_id?: string
      hora_salida?: string | null
      salida_indefinida?: number | boolean | null
    },
  ): Promise<ApiResult<{ ok: true }>> {
    try {
      const arregloId = String(body?.arreglo_id || '').trim()
      if (!arregloId) return { ok: false, error: 'Falta arreglo_id' }

      const salidaIndefinida = !!body?.salida_indefinida
      const horaSalida = salidaIndefinida ? null : (body?.hora_salida ?? null)

      const data = await this.svc.updateByArregloId(arregloId, {
        horaSalida,
        salidaIndefinida,
      })

      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }
}
