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
  UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'

import { ConsultoriosService } from './consultorios.service'
import {
  CreateConsultorioTurnoDto,
  ListConsultoriosQueryDto,
  ConsultorioTurnoResponse,
} from './consultorio.dto'

import {
  JwtCookieAuthGuard,
  type JwtPayload,
} from '../../auth/jwt-cookie.guard'
import { OptionalJwtCookieAuthGuard } from '../../auth/optional-jwt-cookie.guard'

type RequestWithUser = Request & { user?: JwtPayload }

function getHeaderString(req: Request, key: string): string | undefined {
  const v = req.headers[key.toLowerCase()]
  if (Array.isArray(v)) return v[0]
  return typeof v === 'string' ? v : undefined
}

function resolveUserId(req: RequestWithUser): string {
  if (req.user?.sub) return req.user.sub

  const isProd = process.env.NODE_ENV === 'production'
  if (isProd) {
    throw new UnauthorizedException('No autenticado')
  }

  const devHeader = getHeaderString(req, 'x-user-id')
  if (!devHeader) {
    throw new UnauthorizedException(
      'Falta autenticación (cookie) o x-user-id (solo dev)',
    )
  }

  return devHeader
}

@Controller('laboral/consultorios')
export class ConsultoriosController {
  constructor(private readonly service: ConsultoriosService) {}

  @UseGuards(OptionalJwtCookieAuthGuard)
  @Get()
  async list(
    @Req() req: RequestWithUser,
    @Query() q: ListConsultoriosQueryDto,
  ): Promise<ConsultorioTurnoResponse[]> {
    const userId = resolveUserId(req)
    const takeNum = q.take ? Number(q.take) : undefined

    return this.service.list(userId, {
      from: q.from,
      to: q.to,
      q: q.q,
      companyId: q.companyId,
      take: Number.isFinite(takeNum) ? takeNum : undefined,
    })
  }

  @UseGuards(OptionalJwtCookieAuthGuard)
  @Get(':id')
  async getOne(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<ConsultorioTurnoResponse> {
    const userId = resolveUserId(req)
    return this.service.getById(userId, id)
  }

  @UseGuards(JwtCookieAuthGuard)
  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateConsultorioTurnoDto,
  ): Promise<ConsultorioTurnoResponse> {
    const userId = resolveUserId(req)
    return this.service.create(userId, dto)
  }

  @UseGuards(JwtCookieAuthGuard)
  @Delete(':id')
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    const userId = resolveUserId(req)
    return this.service.delete(userId, id)
  }
}
