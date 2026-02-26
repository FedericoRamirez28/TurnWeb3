import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ParteDiarioService } from './parte-diario.service'
import { CreateParteDiarioDto } from './dto/create-parte-diario.dto'
import { Public } from '../auth/public.decorator'

@Controller('moviles')
export class ParteDiarioController {
  constructor(private readonly service: ParteDiarioService) {}

  // ✅ público para chofer
  @Public()
  @Post(':movilId/parte-diario')
  async crear(@Param('movilId') movilId: string, @Body() dto: CreateParteDiarioDto) {
    const created = await this.service.crear(movilId, dto)
    return { ok: true, data: { id: created.id, createdAt: created.createdAt } }
  }

  // ✅ lo usa ArreglosScreen
  @Get(':movilId/parte-diario/ultimo')
  async ultimo(@Param('movilId') movilId: string) {
    const data = await this.service.ultimo(movilId)
    return { ok: true, data }
  }

  // (opcional) por día: útil si querés anexarlo a calendario
  @Get(':movilId/parte-diario/dia')
  async porDia(@Param('movilId') movilId: string, @Query('fecha') fecha: string) {
    const data = await this.service.porDia(movilId, fecha)
    return { ok: true, data }
  }
}
