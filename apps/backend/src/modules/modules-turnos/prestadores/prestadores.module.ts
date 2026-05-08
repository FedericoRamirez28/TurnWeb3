import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';
import { PrestadoresController } from './prestadores.controller';
import { PrestadoresService } from './prestadores.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PrestadoresController],
  providers: [PrestadoresService],
  exports: [PrestadoresService],
})
export class PrestadoresModule {}
