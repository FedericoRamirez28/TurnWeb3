import { Module } from '@nestjs/common'
import { ArreglosController } from './arreglos.controller'
import { ArreglosService } from './arreglos.service'
import { MovilesService } from '../moviles/moviles.service'

@Module({
  controllers: [ArreglosController],
  providers: [ArreglosService, MovilesService],
})
export class ArreglosModule {}
