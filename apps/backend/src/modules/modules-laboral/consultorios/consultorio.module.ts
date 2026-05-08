import { Module } from '@nestjs/common'
import { PrismaModule } from '../../../prisma/prisma.module'
import { AuthModule } from '../../auth/auth.module'

import { ConsultoriosController } from './consultorio.controller'
import { ConsultoriosService } from './consultorios.service'

@Module({
  imports: [
    PrismaModule,
    AuthModule,
  ],
  controllers: [ConsultoriosController],
  providers: [ConsultoriosService],
  exports: [ConsultoriosService],
})
export class ConsultoriosModule {}
