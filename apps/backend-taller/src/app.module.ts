import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'

import { PrismaModule } from './prisma/prisma.module'
import { UsersModule } from './modules/users/users.module'
import { AuthModule } from './modules/auth/auth.module'
import { JwtOrPublicGuard } from './modules/auth/jwt-or-public.guard'
import { MovilesModule } from './modules/moviles/moviles.module'
import { ArreglosModule } from './modules/arreglos/arreglos.module'
import { FinalizadosModule } from './modules/finalizados/finalizados.module'
import { HistorialDiaModule } from './modules/historial-dia/historial-dia.module'
import { CalendarioModule } from './modules/calendario/calendario.module'
import { HistorialModule } from './modules/historial/historial.module'
import { ParteDiarioModule } from './modules/parte-diario/parte-diario.module'


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    MovilesModule,
ArreglosModule,
FinalizadosModule,
HistorialDiaModule,
HistorialModule,
CalendarioModule,
ParteDiarioModule,

  ],
  providers: [{ provide: APP_GUARD, useClass: JwtOrPublicGuard }],
})
export class AppModule {}
