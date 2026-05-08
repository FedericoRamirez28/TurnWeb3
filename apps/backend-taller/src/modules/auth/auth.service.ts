import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UsersService } from '../users/users.service'

type LoginOk = { ok: true; data: { token: string; user: any } }
type LoginErr = { ok: false; error: string }

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginOk | LoginErr> {
    const emailNorm = String(email || '').trim().toLowerCase()
    const user = await this.users.findByEmail(emailNorm)

    if (!user || !user.isActive) {
      return { ok: false as const, error: 'Credenciales inválidas.' }
    }

    const okPass = await bcrypt.compare(String(password || ''), user.passwordHash)
    if (!okPass) return { ok: false as const, error: 'Credenciales inválidas.' }

    const safeUser = this.users.toSafeUser(user)

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    })

    // ✅ ApiResult consistente
    return {
      ok: true as const,
      data: {
        token,
        user: safeUser,
      },
    }
  }
}
