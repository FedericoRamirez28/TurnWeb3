import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ParteDiarioController } from './parte-diario.controller'
import { ParteDiarioService } from './parte-diario.service'

@Module({
  imports: [PrismaModule],
  controllers: [ParteDiarioController],
  providers: [ParteDiarioService],
  exports: [ParteDiarioService],
})
export class ParteDiarioModule {}
