import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'

type JwtPayload = {
  sub: string
  email: string
  role: string
  iat: number
  exp: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get<string>('JWT_SECRET') || 'dev-secret',
    })
  }

  async validate(payload: JwtPayload) {
    // esto queda disponible como req.user
    return { userId: payload.sub, email: payload.email, role: payload.role }
  }
}
