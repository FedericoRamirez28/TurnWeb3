// apps/backend/src/modules/laboral/consultorios/consultorios.module.ts
import { Module } from '@nestjs/common';
import { ConsultoriosController } from './consultorio.controller';
import { ConsultoriosService } from './consultorios.service';

// IMPORTANTE: Asegúrate de que la ruta sea correcta hacia tu AuthModule
import { AuthModule } from '../../auth/auth.module'; 

@Module({
  imports: [
    AuthModule // <--- ESTO ES LO QUE FALTA. Al importar AuthModule, traes el JwtService y el Guard.
  ],
  controllers: [ConsultoriosController],
  providers: [ConsultoriosService],
})
export class ConsultoriosModule {}