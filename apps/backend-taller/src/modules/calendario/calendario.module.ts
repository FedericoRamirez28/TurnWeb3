// apps/backend-taller/src/modules/calendario/calendario.module.ts

import { Module } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { MovilesService } from '../moviles/moviles.service'
import { CalendarioController } from './calendario.controller'
import { CalendarioService } from './calendario.service'

@Module({
  controllers: [CalendarioController],
  providers: [CalendarioService, PrismaService, MovilesService],
  exports: [CalendarioService],
})
export class CalendarioModule {}
