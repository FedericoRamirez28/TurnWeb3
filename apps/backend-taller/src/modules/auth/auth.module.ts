import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ConfigModule, ConfigService } from '@nestjs/config'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { JwtStrategy } from './jwt.strategy'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [
    ConfigModule,
    UsersModule,

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        const secret = cfg.get<string>('JWT_SECRET') || 'dev_secret_change_me'
        const expiresIn = cfg.get<string>('JWT_EXPIRES_IN') || '7d'

        // ✅ casteo suave para evitar el error de tipos (tu value "7d" es válido para jsonwebtoken)
        return {
          secret,
          signOptions: { expiresIn: expiresIn as any },
        }
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
