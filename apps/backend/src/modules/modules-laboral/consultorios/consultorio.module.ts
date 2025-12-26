// apps/backend/src/modules/laboral/consultorios/consultorios.module.ts
import { Module } from '@nestjs/common';
import { ConsultoriosController } from './consultorio.controller';
import { ConsultoriosService } from './consultorios.service';

@Module({
  controllers: [ConsultoriosController],
  providers: [ConsultoriosService],
})
export class ConsultoriosModule {}
