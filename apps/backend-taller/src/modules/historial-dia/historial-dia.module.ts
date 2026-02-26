import { Module } from '@nestjs/common'
import { HistorialDiaController } from './historial-dia.controller'
import { HistorialDiaService } from './historial-dia.service'
import { MovilesService } from '../moviles/moviles.service'

@Module({
  controllers: [HistorialDiaController],
  providers: [HistorialDiaService, MovilesService],
})
export class HistorialDiaModule {}
