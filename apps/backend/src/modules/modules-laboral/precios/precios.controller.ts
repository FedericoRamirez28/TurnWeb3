import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { PreciosService } from './precios.service';

type PlanKey = 'ALL' | 'BASE' | 'ESMERALDA' | 'RUBI' | 'DORADO' | 'PARTICULAR';
type ScopeKey = 'laboratorio' | 'especialidad' | 'ambos';
type ModeKey = 'increase' | 'decrease';

function parsePlan(plan?: string): PlanKey {
  const v = (plan ?? 'ALL').toUpperCase().trim();
  const allowed: PlanKey[] = [
    'ALL',
    'BASE',
    'ESMERALDA',
    'RUBI',
    'DORADO',
    'PARTICULAR',
  ];
  if (!allowed.includes(v as PlanKey))
    throw new BadRequestException('plan inválido');
  return v as PlanKey;
}

function parseScope(scope?: string): ScopeKey {
  const v = (scope ?? 'ambos').toLowerCase().trim();
  const allowed: ScopeKey[] = ['laboratorio', 'especialidad', 'ambos'];
  if (!allowed.includes(v as ScopeKey))
    throw new BadRequestException('scope inválido');
  return v as ScopeKey;
}

function parseMode(mode?: string): ModeKey {
  const v = (mode ?? 'increase').toLowerCase().trim();
  const allowed: ModeKey[] = ['increase', 'decrease'];
  if (!allowed.includes(v as ModeKey))
    throw new BadRequestException('mode inválido');
  return v as ModeKey;
}

@Controller('laboral/precios')
export class PreciosController {
  constructor(private readonly svc: PreciosService) {}

  // ================= TURNOS =================

  @Get('turnos/rows')
  async listTurnosRows(
    @Query('plan') planRaw: string | undefined,
    @Query('q') q = '',
    @Query('scope') scopeRaw: string | undefined,
  ) {
    const plan = parsePlan(planRaw);
    const scope = parseScope(scopeRaw);
    return this.svc.listTurnosRows({ plan, q, scope });
  }

  @Post('turnos/adjust')
  async adjustTurnos(
    @Body()
    body: {
      plan: PlanKey;
      scope: ScopeKey;
      mode: ModeKey;
      percent: number;
    },
  ) {
    return this.svc.adjustTurnos({
      plan: parsePlan(body.plan),
      scope: parseScope(body.scope),
      mode: parseMode(body.mode),
      percent: body.percent,
    });
  }

  @Get('turnos/bundle')
  async getTurnosBundle() {
    return this.svc.getTurnosBundle();
  }

  @Get('turnos/version')
  async getTurnosVersion() {
    return this.svc.getTurnosVersion();
  }

  // ================= LABORAL =================
  // ✅ endpoint nuevo para el TAB de Medicina Laboral
  @Get('laboral/rows')
  async listLaboralRows(
    @Query('categoria') categoria?: string,
    @Query('q') q = '',
  ) {
    return this.svc.listLaboralRows({ categoria, q });
  }

  // ✅ alias por compatibilidad (si algo ya pegaba a /laboral/precios/laboral)
  @Get('laboral')
  async listLaboralAlias(
    @Query('categoria') categoria?: string,
    @Query('q') q = '',
  ) {
    return this.svc.listLaboralRows({ categoria, q });
  }

  @Post('laboral/adjust')
  async adjustLaboral(
    @Body() body: { categoria?: string; mode: ModeKey; percent: number },
  ) {
    return this.svc.adjustLaboral({
      categoria: body.categoria,
      mode: parseMode(body.mode),
      percent: body.percent,
    });
  }
}
