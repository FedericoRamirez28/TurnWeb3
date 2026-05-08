import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TurnosPlan, TurnosPrecioTipo } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

type PlanKey = 'ALL' | 'BASE' | 'ESMERALDA' | 'RUBI' | 'DORADO' | 'PARTICULAR';
type ScopeKey = 'laboratorio' | 'especialidad' | 'ambos';
type ModeKey = 'increase' | 'decrease';

const LABORAL_SEED_2025_11 = [
  {
    categoria: 'concepto',
    nombre:
      'Preocupacional, periódico o egreso, Básico de Ley, Masculino y Femenino.',
    valorSocios: 65899,
    valorNoSocios: 90895,
  },
  {
    categoria: 'concepto',
    nombre: 'Psicotécnico',
    valorSocios: 44539,
    valorNoSocios: 52265,
  },
  {
    categoria: 'concepto',
    nombre:
      'Psicotécnico para trabajos en Altura / Manejo de Autoelevadores / Clarkista',
    valorSocios: 74307,
    valorNoSocios: 86805,
  },
  {
    categoria: 'concepto',
    nombre: 'Evaluación Neurológica (Requiere turno previo)*',
    valorSocios: 64208,
    valorNoSocios: 83319,
  },
  {
    categoria: 'concepto',
    nombre: 'Electroencefalografía (Requiere turno previo)*',
    valorSocios: 80512,
    valorNoSocios: 104516,
  },
  {
    categoria: 'concepto',
    nombre: 'Ergometría (Requiere turno previo)*',
    valorSocios: 72548,
    valorNoSocios: 94237,
  },
  {
    categoria: 'concepto',
    nombre: 'Rx. Col. Lumbosacra F y P (2)',
    valorSocios: 46552,
    valorNoSocios: 60400,
  },
  {
    categoria: 'concepto',
    nombre: 'Rx. Col. Cervical F y P (2)',
    valorSocios: 46552,
    valorNoSocios: 60400,
  },
  {
    categoria: 'concepto',
    nombre: 'Audiometría',
    valorSocios: 32107,
    valorNoSocios: 41660,
  },
  {
    categoria: 'concepto',
    nombre: 'Sub Unidad Beta',
    valorSocios: 20466,
    valorNoSocios: 26556,
  },
  {
    categoria: 'concepto',
    nombre: 'Cocaína',
    valorSocios: 20466,
    valorNoSocios: 26556,
  },
  {
    categoria: 'concepto',
    nombre: 'Marihuana',
    valorSocios: 20466,
    valorNoSocios: 26556,
  },
  {
    categoria: 'concepto',
    nombre: 'HIV',
    valorSocios: 20466,
    valorNoSocios: 26556,
  },
  {
    categoria: 'concepto',
    nombre: 'EEG con informe',
    valorSocios: 20466,
    valorNoSocios: 26556,
  },
  {
    categoria: 'concepto',
    nombre: 'Espirometría',
    valorSocios: 31777,
    valorNoSocios: 41254,
  },

  {
    categoria: 'lab',
    nombre: 'Grupo y Factor (C/U)',
    valorSocios: 3683,
    valorNoSocios: 5973,
  },
  {
    categoria: 'lab',
    nombre: 'Colesterol Total',
    valorSocios: 3683,
    valorNoSocios: 5973,
  },
  { categoria: 'lab', nombre: 'HDL', valorSocios: 3683, valorNoSocios: 5973 },
  { categoria: 'lab', nombre: 'LDL', valorSocios: 3683, valorNoSocios: 5973 },
  {
    categoria: 'lab',
    nombre: 'Triglicéridos',
    valorSocios: 3683,
    valorNoSocios: 5973,
  },
  {
    categoria: 'lab',
    nombre: 'Glucemia',
    valorSocios: 3683,
    valorNoSocios: 5973,
  },
  {
    categoria: 'lab',
    nombre: 'Reacción de Huddleson',
    valorSocios: 5407,
    valorNoSocios: 8390,
  },
  {
    categoria: 'lab',
    nombre: 'V.D.R.L',
    valorSocios: 5407,
    valorNoSocios: 8390,
  },
  {
    categoria: 'lab',
    nombre: 'Hepatograma',
    valorSocios: 7225,
    valorNoSocios: 11223,
  },
  { categoria: 'lab', nombre: 'TSH', valorSocios: 10693, valorNoSocios: 16569 },
  { categoria: 'lab', nombre: 'T3', valorSocios: 10693, valorNoSocios: 16569 },
  { categoria: 'lab', nombre: 'T4', valorSocios: 10693, valorNoSocios: 16569 },
] as const;

const PLAN_ENUM: Record<Exclude<PlanKey, 'ALL'>, TurnosPlan> = {
  BASE: TurnosPlan.BASE,
  ESMERALDA: TurnosPlan.ESMERALDA,
  RUBI: TurnosPlan.RUBI,
  DORADO: TurnosPlan.DORADO,
  PARTICULAR: TurnosPlan.PARTICULAR,
};

function toTipo(scope: ScopeKey): TurnosPrecioTipo | null {
  if (scope === 'laboratorio') return TurnosPrecioTipo.LABORATORIO;
  if (scope === 'especialidad') return TurnosPrecioTipo.ESPECIALIDAD;
  return null;
}

@Injectable()
export class PreciosService {
  constructor(private readonly prisma: PrismaService) {}

  private factor(mode: ModeKey, percent: number) {
    const p = Number(percent);
    if (!Number.isFinite(p) || p <= 0 || p > 200) {
      throw new BadRequestException('percent inválido (1 a 200)');
    }
    return mode === 'increase' ? 1 + p / 100 : 1 - p / 100;
  }

  // ===================== TURNOS =====================

  async listTurnosRows(params: { plan: PlanKey; q: string; scope: ScopeKey }) {
    const { plan, q, scope } = params;

    const where: Prisma.TurnosPrecioWhereInput = {
      isActive: true,
      ...(plan !== 'ALL' ? { plan: PLAN_ENUM[plan] } : {}),
      ...(scope !== 'ambos' ? { tipo: toTipo(scope)! } : {}),
      ...(q?.trim()
        ? { nombre: { contains: q.trim(), mode: 'insensitive' } }
        : {}),
    };

    const rows = await this.prisma.turnosPrecio.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }, { plan: 'asc' }],
    });

    return { rows };
  }

  async adjustTurnos(body: {
    plan: PlanKey;
    scope: ScopeKey;
    mode: ModeKey;
    percent: number;
  }) {
    const { plan, scope, mode, percent } = body;
    const f = this.factor(mode, percent);
    const tipo = toTipo(scope);

    // OJO: "plan" y "tipo" son enums en Postgres, Prisma manda params como TEXT.
    // Solución: casteamos la COLUMNA a text.
    const planSql =
      plan === 'ALL'
        ? Prisma.empty
        : Prisma.sql`AND "plan"::text = ${PLAN_ENUM[plan]}`;

    const tipoSql =
      tipo === null ? Prisma.empty : Prisma.sql`AND "tipo"::text = ${tipo}`;

    const updated = await this.prisma.$executeRaw<number>(Prisma.sql`
    UPDATE "turnos_precios"
    SET
      "valor" = GREATEST(0, ROUND("valor" * ${f})::int),
      "updatedAt" = NOW()
    WHERE "isActive" = true
    ${planSql}
    ${tipoSql};
  `);

    return { updated };
  }

  async getTurnosBundle() {
    const rows = await this.prisma.turnosPrecio.findMany({
      where: { isActive: true },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }, { plan: 'asc' }],
    });

    const emptyPlans = {
      BASE: {} as Record<string, number>,
      ESMERALDA: {} as Record<string, number>,
      RUBI: {} as Record<string, number>,
      DORADO: {} as Record<string, number>,
      PARTICULAR: {} as Record<string, number>,
    };

    const laboratoriosTarifas = { ...emptyPlans };
    const especialidadesTarifas = { ...emptyPlans };

    for (const r of rows) {
      const planKey = (
        Object.keys(PLAN_ENUM) as Exclude<PlanKey, 'ALL'>[]
      ).find((k) => PLAN_ENUM[k] === r.plan);
      if (!planKey) continue;

      if (r.tipo === TurnosPrecioTipo.LABORATORIO) {
        laboratoriosTarifas[planKey][r.nombre] = r.valor;
      } else {
        especialidadesTarifas[planKey][r.nombre] = r.valor;
      }
    }

    const laboratorioOptions = Array.from(
      new Set(
        Object.values(laboratoriosTarifas).flatMap((m) => Object.keys(m)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const especialidadesOptions = Array.from(
      new Set(
        Object.values(especialidadesTarifas).flatMap((m) => Object.keys(m)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    const updatedAt =
      rows.length === 0
        ? new Date(0)
        : rows.reduce(
            (max, r) => (r.updatedAt > max ? r.updatedAt : max),
            rows[0].updatedAt,
          );

    return {
      laboratoriosTarifas,
      especialidadesTarifas,
      laboratorioOptions,
      especialidadesOptions,
      updatedAt,
    };
  }

  async getTurnosVersion() {
    const last = await this.prisma.turnosPrecio.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    return {
      updatedAt: last?.updatedAt?.toISOString?.() ?? new Date(0).toISOString(),
    };
  }

  // ===================== LABORAL =====================

  private async ensureLaboralSeed() {
    const count = await this.prisma.laboralPrecio.count();
    if (count > 0) return;

    await this.prisma.laboralPrecio.createMany({
      data: LABORAL_SEED_2025_11.map((x) => ({
        categoria: x.categoria,
        nombre: x.nombre,
        valorSocios: x.valorSocios,
        valorNoSocios: x.valorNoSocios,
        isActive: true,
      })),
    });
  }

  // ✅ Nuevo: listado con filtros tipados (sin any y sin tocar controller)
  async listLaboralRows(params: { categoria?: string; q?: string }) {
    await this.ensureLaboralSeed();

    const categoria = (params.categoria ?? '').trim();
    const q = (params.q ?? '').trim();

    const where: Prisma.LaboralPrecioWhereInput = {
      isActive: true,
      ...(categoria && categoria.toUpperCase() !== 'ALL' ? { categoria } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { categoria: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.laboralPrecio.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }],
    });

    return { rows };
  }

  async adjustLaboral(body: {
    categoria?: string;
    mode: ModeKey;
    percent: number;
  }) {
    await this.ensureLaboralSeed();

    const { categoria, mode, percent } = body;
    const f = this.factor(mode, percent);

    const cat = (categoria ?? '').trim();
    const catSql = cat ? Prisma.sql`AND "categoria" = ${cat}` : Prisma.empty;

    const updated = await this.prisma.$executeRaw<number>(Prisma.sql`
      UPDATE "laboral_precios"
      SET
        "valorSocios" = GREATEST(0, ROUND("valorSocios" * ${f})::int),
        "valorNoSocios" = GREATEST(0, ROUND("valorNoSocios" * ${f})::int),
        "updatedAt" = NOW()
      WHERE "isActive" = true
      ${catSql};
    `);

    return { updated };
  }
}
