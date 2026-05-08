import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import type { Request } from 'express'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { Public } from './public.decorator'

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ✅ PUBLIC: login
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password)
  }

  // ✅ PRIVADO: validar token y devolver usuario
  @Get('me')
  async me(@Req() req: Request) {
    const u = (req as any).user
    return { ok: true, data: u }
  }
}
