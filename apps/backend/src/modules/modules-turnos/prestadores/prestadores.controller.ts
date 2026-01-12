import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrestadoresService } from './prestadores.service';
import { JwtCookieAuthGuard } from '../../auth/jwt-cookie.guard';

@Controller('prestadores')
export class PrestadoresController {
  constructor(private readonly svc: PrestadoresService) {}

  // ✅ lista para selects (protegida por login)
  @UseGuards(JwtCookieAuthGuard)
  @Get('active')
  async listActive() {
    const prestadores = await this.svc.listActive();
    return { prestadores };
  }
}
