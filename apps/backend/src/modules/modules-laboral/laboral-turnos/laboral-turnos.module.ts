import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { LaboralTurnosController } from './laboral-turnos.controller';
import { LaboralTurnosService } from './laboral-turnos.service';

@Module({
  imports: [PrismaModule],
  controllers: [LaboralTurnosController],
  providers: [LaboralTurnosService],
})
export class LaboralTurnosModule {}
