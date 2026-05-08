import { Module } from '@nestjs/common'
import { FinalizadosController } from './finalizados.controller'
import { FinalizadosService } from './finalizados.service'
import { MovilesService } from '../moviles/moviles.service'

@Module({
  controllers: [FinalizadosController],
  providers: [FinalizadosService, MovilesService],
})
export class FinalizadosModule {}
