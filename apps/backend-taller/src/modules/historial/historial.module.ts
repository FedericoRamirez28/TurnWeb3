import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { MovilesModule } from '../moviles/moviles.module'
import { HistorialController } from './historial.controller'
import { HistorialService } from './historial.service'

@Module({
  imports: [PrismaModule, MovilesModule],
  controllers: [HistorialController],
  providers: [HistorialService],
})
export class HistorialModule {}
