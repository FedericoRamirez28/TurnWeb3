import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BonosAtencionService } from './bonos-atencion.service';
import type { CreateBonoAtencionDto } from './bonos-atencion.dto';
import {
  JwtCookieAuthGuard,
  type JwtPayload,
} from '../../auth/jwt-cookie.guard';
import { OptionalJwtCookieAuthGuard } from '../../auth/optional-jwt-cookie.guard';

type ReqWithUser = Request & { user?: JwtPayload };

@Controller('bonos-atencion')
export class BonosAtencionController {
  constructor(private readonly svc: BonosAtencionService) {}

  // ✅ emitir: solo recepcion/admin
  @UseGuards(JwtCookieAuthGuard)
  @Post()
  async create(@Body() dto: CreateBonoAtencionDto, @Req() req: ReqWithUser) {
    const role = String(req.user?.role ?? '').toLowerCase();
    if (role !== 'admin' && role !== 'recepcion') {
      throw new ForbiddenException('No autorizado');
    }
    return this.svc.create(dto, req.user!.sub);
  }

  // ✅ verificar: público (si hay cookie la usamos para log/auditoría)
  @UseGuards(OptionalJwtCookieAuthGuard)
  @Get('verificar/:code')
  async verificar(
    @Param('code') code: string,
    @Query('t') t: string | undefined,
    @Req() req: ReqWithUser,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ||
      (req.socket?.remoteAddress ?? undefined);

    const userAgent = String(req.headers['user-agent'] ?? '');

    // ✅ si hay prestador logueado, pasamos su userId (sub) y el service resuelve a prestadorId
    const role = String(req.user?.role ?? '').toLowerCase();
    const maybePrestadorUserId =
      role === 'prestador' ? req.user?.sub : undefined;

    return this.svc.verificar(code, t, {
      ip,
      userAgent,
      prestadorUserId: maybePrestadorUserId, // 👈 lo acepta el service (ver abajo)
    });
  }

  // ✅ usar: solo prestador logueado
  @UseGuards(JwtCookieAuthGuard)
  @Post(':code/usar')
  async usar(@Param('code') code: string, @Req() req: ReqWithUser) {
    const role = String(req.user?.role ?? '').toLowerCase();
    if (role !== 'prestador') {
      throw new ForbiddenException('Solo prestadores');
    }
    return this.svc.usar(code, req.user!.sub);
  }
}
