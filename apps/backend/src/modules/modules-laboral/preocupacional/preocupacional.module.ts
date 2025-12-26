import { Module } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PreocupacionalController } from './preocupacional.controller';
import { PreocupacionalService } from './preocupacional.service';

@Module({
  controllers: [PreocupacionalController],
  providers: [PreocupacionalService, PrismaService],
})
export class PreocupacionalModule {}
