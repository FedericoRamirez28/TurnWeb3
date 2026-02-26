import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { MovilesController } from './moviles.controller'
import { MovilesService } from './moviles.service'

@Module({
  imports: [PrismaModule],
  controllers: [MovilesController],
  providers: [MovilesService],
  exports: [MovilesService], // ✅ CLAVE: permite inyectarlo desde otros módulos
})
export class MovilesModule {}
