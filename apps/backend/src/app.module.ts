import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AfiliadosModule } from './modules/modules-turnos/afiliados/afiliados.module';
import { TurnosModule } from './modules/modules-turnos/turnos/turnos.module';
import { CajaModule } from './modules/modules-turnos/caja/caja.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/modules-laboral/companies/companies.module';
import { LaboralTurnosModule } from './modules/modules-laboral/laboral-turnos/laboral-turnos.module';
import { LaboralNotesModule } from './modules/modules-laboral/notes/laboral-notes.module';
import { PortadasModule } from './modules/modules-laboral/portadas/portadas.module';
import { ConsultoriosModule } from './modules/modules-laboral/consultorios/consultorio.module';
import { AdicionalesModule } from './modules/modules-laboral/adicionales/adicionales.module';
import { PreciosModule } from './modules/modules-laboral/precios/precios.module';
import { BonosAtencionModule } from './modules/modules-turnos/bonos-atencion/bonos-atencion.module';
import { PrestadoresModule } from './modules/modules-turnos/prestadores/prestadores.module';

@Module({
  imports: [
    PrismaModule,
    AfiliadosModule,
    TurnosModule,
    CajaModule,
    AuthModule,
    CompaniesModule,
    LaboralTurnosModule,
    LaboralNotesModule,
    PortadasModule,
    ConsultoriosModule,
    AdicionalesModule,
    PreciosModule,
    BonosAtencionModule,
    PrestadoresModule,
  ],
})
export class AppModule {}
