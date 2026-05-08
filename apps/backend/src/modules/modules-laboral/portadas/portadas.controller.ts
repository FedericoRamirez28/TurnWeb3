import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { LaboralPortada } from '@prisma/client';

import { PortadasService } from './portadas.service';
import { CreateOrUpdatePortadaDto, ListPortadasQueryDto } from './portadas.dto';
import { JwtCookieAuthGuard, JwtPayload } from '../../auth/jwt-cookie.guard';
import { OptionalJwtCookieAuthGuard } from '../../auth/optional-jwt-cookie.guard';

type RequestWithUser = Request & { user?: JwtPayload };

function getHeaderString(req: Request, key: string): string | undefined {
  const v = req.headers[key.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' ? v : undefined;
}

/**
 * ✅ Producción: userId = req.user.sub (cookie JWT)
 * ✅ Dev: si no hay cookie, permitimos x-user-id SOLO si NODE_ENV !== 'production'
 *    (y debe ser un id real de la tabla users)
 */
function resolveUserId(req: RequestWithUser): string {
  if (req.user?.sub) return req.user.sub;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    throw new UnauthorizedException('No autenticado');
  }

  const devHeader = getHeaderString(req, 'x-user-id');
  if (!devHeader) {
    throw new UnauthorizedException(
      'Falta autenticación (cookie) o x-user-id (solo dev)',
    );
  }

  return devHeader;
}

@Controller('laboral/portadas')
export class PortadasController {
  constructor(private readonly service: PortadasService) {}

  // ✅ Guard opcional: si hay cookie, setea req.user; si no, no bloquea y cae al x-user-id en dev
  @UseGuards(OptionalJwtCookieAuthGuard)
  @Get()
  async list(
    @Req() req: RequestWithUser,
    @Query() q: ListPortadasQueryDto,
  ): Promise<LaboralPortada[]> {
    const userId = resolveUserId(req);

    const takeNum = q.take ? Number(q.take) : undefined;
    const take = Number.isFinite(takeNum) ? takeNum : undefined;

    return this.service.list(userId, { q: q.q, take });
  }

  @UseGuards(OptionalJwtCookieAuthGuard)
  @Get(':id')
  async getOne(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<LaboralPortada> {
    const userId = resolveUserId(req);
    const found = await this.service.getById(userId, id);
    if (!found) throw new NotFoundException('Portada no encontrada');
    return found;
  }

  // ✅ Estricto (cookie) para escribir/borrar
  @UseGuards(JwtCookieAuthGuard)
  @Post()
  async upsert(
    @Req() req: RequestWithUser,
    @Body() dto: CreateOrUpdatePortadaDto,
  ): Promise<LaboralPortada> {
    const userId = resolveUserId(req);
    return this.service.upsertByDni(userId, dto);
  }

  @UseGuards(JwtCookieAuthGuard)
  @Delete(':id')
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    const userId = resolveUserId(req);
    await this.service.delete(userId, id);
    return { ok: true };
  }
}
