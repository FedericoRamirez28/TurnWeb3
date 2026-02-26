import { Controller, Get, Put, Body, Query } from '@nestjs/common'
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

      const data = movilRaw
        ? await this.svc.listByMovil(movilRaw, f)
        : await this.svc.listAll(f)

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
