import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

import { PortadasController } from './portadas.controller';
import { PortadasService } from './portadas.service';

@Module({
  imports: [
    PrismaModule, // ✅ PrismaService disponible
    AuthModule, // ✅ JwtCookieAuthGuard + JwtService disponibles (exportados)
  ],
  controllers: [PortadasController],
  providers: [PortadasService],
  exports: [PortadasService],
})
export class PortadasModule {}
