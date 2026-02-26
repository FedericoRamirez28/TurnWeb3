// src/modules/arreglos/arreglos.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ArreglosService } from './arreglos.service'
import { CreateArregloDto, UpdateArregloDto } from './dto/arreglos.dto'

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

@Controller('arreglos')
export class ArreglosController {
  constructor(private readonly svc: ArreglosService) {}

  @Get()
  async list(@Query('movilId') movilId: string): Promise<ApiResult<any[]>> {
    try {
      if (!movilId) return { ok: true, data: [] }
      const data = await this.svc.listByMovil(String(movilId))
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Post()
  async create(@Body() dto: CreateArregloDto): Promise<ApiResult<any>> {
    try {
      const data = await this.svc.create(dto)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateArregloDto): Promise<ApiResult<any>> {
    try {
      const data = await this.svc.update(id, dto)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<ApiResult<{ ok: true }>> {
    try {
      const data = await this.svc.remove(id)
      return { ok: true, data }
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Error' }
    }
  }
}
