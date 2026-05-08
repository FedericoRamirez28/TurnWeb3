import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

import { BonosAtencionController } from './bonos-atencion.controller';
import { BonosAtencionService } from './bonos-atencion.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BonosAtencionController],
  providers: [BonosAtencionService],
})
export class BonosAtencionModule {}
