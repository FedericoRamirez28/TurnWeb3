import { Module } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdicionalesController } from './adicionales.controller';
import { AdicionalesService } from './adicionales.service';

@Module({
  controllers: [AdicionalesController],
  providers: [AdicionalesService, PrismaService],
})
export class AdicionalesModule {}
