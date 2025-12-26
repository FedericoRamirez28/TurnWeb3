// apps/backend/src/modules/laboral/consultorios/consultorios.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards, // <--- 1. Importamos UseGuards
} from '@nestjs/common';
import type { Request } from 'express';

import { ConsultoriosService } from './consultorios.service';
import {
  CreateConsultorioTurnoDto,
  ListConsultoriosQueryDto,
  ConsultorioTurnoResponse,
} from './consultorio.dto';

// <--- 2. Importamos tu Guard y el tipo del payload
// Ajusta la ruta ('../../auth/jwt-cookie.guard') si tu archivo está en otra carpeta, 
// pero usualmente es ../../auth/...
import { JwtCookieAuthGuard, type JwtPayload } from '../../auth/jwt-cookie.guard';

type RequestWithUser = Request & { user?: JwtPayload };

function getHeaderString(req: Request, key: string): string | undefined {
  const v = req.headers[key.toLowerCase()];
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' ? v : undefined;
}

function resolveUserId(req: RequestWithUser): string {
  // Si el Guard se ejecutó correctamente, req.user ya tiene los datos
  if (req.user?.sub) return req.user.sub;

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) throw new UnauthorizedException('No autenticado');

  // Fallback para desarrollo (si el guard falló o no se usó cookie en postman/curl)
  const devHeader = getHeaderString(req, 'x-user-id');
  if (!devHeader) {
    throw new UnauthorizedException(
      'Falta autenticación (cookie) o x-user-id (solo dev)',
    );
  }
  return devHeader;
}

@Controller('laboral/consultorios')
@UseGuards(JwtCookieAuthGuard) // <--- 3. APLICAMOS EL GUARD AQUÍ
export class ConsultoriosController {
  constructor(private readonly service: ConsultoriosService) {}

  @Get()
  async list(
    @Req() req: RequestWithUser,
    @Query() q: ListConsultoriosQueryDto,
  ): Promise<ConsultorioTurnoResponse[]> {
    const userId = resolveUserId(req);
    const takeNum = q.take ? Number(q.take) : undefined;

    return this.service.list(userId, {
      from: q.from,
      to: q.to,
      q: q.q,
      companyId: q.companyId,
      take: Number.isFinite(takeNum) ? takeNum : undefined,
    });
  }

  @Get(':id')
  async getOne(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<ConsultorioTurnoResponse> {
    const userId = resolveUserId(req);
    return this.service.getById(userId, id);
  }

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateConsultorioTurnoDto,
  ): Promise<ConsultorioTurnoResponse> {
    const userId = resolveUserId(req);
    return this.service.create(userId, dto);
  }

  @Delete(':id')
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    const userId = resolveUserId(req);
    return this.service.delete(userId, id);
  }
}