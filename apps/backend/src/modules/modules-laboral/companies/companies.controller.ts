import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  JwtCookieAuthGuard,
  type JwtPayload,
} from '../../auth/jwt-cookie.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto';

type AuthedReq = Request & { user?: JwtPayload };

@Controller('laboral/companies')
@UseGuards(JwtCookieAuthGuard)
export class CompaniesController {
  constructor(private service: CompaniesService) {}

  @Get()
  async list(
    @Query('q') q?: string,
    @Query('filter') filter?: 'actives' | 'inactive' | 'all',
  ) {
    const rows = await this.service.list({ q, filter });
    return {
      items: rows.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    };
  }

  @Post()
  async create(@Req() req: AuthedReq, @Body() dto: CreateCompanyDto) {
    const created = await this.service.create(dto, req.user?.sub);
    return {
      item: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    const updated = await this.service.update(id, dto);
    return {
      item: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ✅ padrón de empleados por empresa
  @Get(':id/padron')
  async padron(@Param('id') id: string) {
    const items = await this.service.padron(id);
    return { items };
  }

  // ✅ NUEVO: eliminar empleado del padrón por DNI (soft delete)
  @Delete(':id/padron/:dni')
  async removeFromPadron(@Param('id') id: string, @Param('dni') dni: string) {
    return this.service.removeFromPadron(id, dni);
  }
}
