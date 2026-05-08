import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AdicionalesService } from './adicionales.service';
import { ListAdicionalesQueryDto } from './adicionales.dto';
import type { CreateAdicionalDto } from './adicionales.dto';

type AuthUser = { sub?: string; userId?: string; username?: string };
type AuthRequest = Request & { user?: AuthUser };

function getUserKey(req: AuthRequest): string {
  // priorizamos auth real si existe; si no, header dev
  return (
    req.user?.sub ??
    req.user?.userId ??
    req.user?.username ??
    String(req.headers['x-user-id'] ?? 'dev-user')
  );
}

@Controller('laboral/adicionales')
export class AdicionalesController {
  constructor(private readonly service: AdicionalesService) {}

  @Get()
  async list(@Req() req: AuthRequest, @Query() q: ListAdicionalesQueryDto) {
    const userKey = getUserKey(req);
    return this.service.list(userKey, {
      q: q.q,
      empresa: q.empresa,
      from: q.from,
      to: q.to,
      take: q.take,
    });
  }

  @Post('batch')
  async createBatch(
    @Req() req: AuthRequest,
    @Body() items: CreateAdicionalDto[],
  ) {
    const userKey = getUserKey(req);
    return this.service.createBatch(userKey, items);
  }

  @Delete(':id')
  async remove(@Req() req: AuthRequest, @Param('id') id: string) {
    const userKey = getUserKey(req);
    return this.service.delete(userKey, id);
  }
}
