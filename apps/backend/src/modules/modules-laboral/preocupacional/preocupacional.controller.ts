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
import type { Request } from 'express';
import { PreocupacionalService } from './preocupacional.service';
import {
  CreateAdicionalesBatchDto,
  ListAdicionalesQueryDto,
} from './adicionales.dto';
import { getUserId } from '../../../common/user-id';

@Controller('laboral/preocupacional')
export class PreocupacionalController {
  constructor(private readonly service: PreocupacionalService) {}

  @Get('adicionales')
  async list(@Req() req: Request, @Query() q: ListAdicionalesQueryDto) {
    const userId = getUserId(req);
    return this.service.listAdicionales(userId, q);
  }

  @Post('adicionales/batch')
  async createBatch(
    @Req() req: Request,
    @Body() dto: CreateAdicionalesBatchDto,
  ) {
    const userId = getUserId(req);
    return this.service.createAdicionalesBatch(userId, dto.items);
  }

  @Delete('adicionales/:id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    const userId = getUserId(req);
    return this.service.deleteAdicional(userId, id);
  }
}
