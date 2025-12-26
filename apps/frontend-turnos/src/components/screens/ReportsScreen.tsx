import React, { useState } from 'react';
import type { Appointment, Affiliate } from '@/components/screens/HomeScreen';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';

type TimeRange = 'daily' | 'weekly' | 'monthly';

interface RangeStats {
  range: TimeRange;
  label: string;
  subtitle: string;
  totalRecepcionados: number;
  totalCancelados: number;
  plans: { label: string; value: number }[];
  prestadores: { label: string; value: number }[];
  topEspecialidad: { label: string; value: number } | null;
  worstEspecialidad: { label: string; value: number } | null;
  topLaboratorio: { label: string; value: number } | null;
  worstLaboratorio: { label: string; value: number } | null;
  totalTitulares: number;
  totalAdherentes: number;
}

const PLAN_KEYS = ['RUBI', 'ESMERALDA', 'BASE', 'PARTICULAR', 'DORADO'] as const;
type PlanClave = (typeof PLAN_KEYS)[number];

const PRESTADORES = [
  'VITAS',
  'CEPEM',
  'DOCTORES MOLINAS',
  'SIGMA',
  'TESLA',
  'TC HAEDO',
  'MEDIC',
] as const;

const normalizePlan = (planRaw?: string | null): PlanClave | 'OTROS' | null => {
  if (!planRaw) return null;
  const up = planRaw.toUpperCase();
  if (up.includes('RUBI')) return 'RUBI';
  if (up.includes('ESMERALDA')) return 'ESMERALDA';
  if (up.includes('BASE')) return 'BASE';
  if (up.includes('PART')) return 'PARTICULAR';
  return 'OTROS';
};

const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

const startOfWeekMonday = (d: Date) => {
  const day = d.getDay(); 
  const diff = (day + 6) % 7; 
  const base = startOfDay(d);
  base.setDate(base.getDate() - diff);
  return base;
};

const isInRange = (isoDate: string, range: TimeRange, today: Date): boolean => {
  const d = startOfDay(parseISODate(isoDate));
  const t = startOfDay(today);

  if (range === 'daily') {
    return d.getTime() === t.getTime();
  }

  if (range === 'monthly') {
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth();
  }

  // weekly
  const weekStart = startOfWeekMonday(t);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7); 
  return d >= weekStart && d < weekEnd;
};

const formatRangeLabel = (
  range: TimeRange,
  today: Date
): { label: string; subtitle: string } => {
  const t = startOfDay(today);

  if (range === 'daily') {
    const subtitle = t.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return { label: 'Diario', subtitle };
  }

  if (range === 'weekly') {
    const weekStart = startOfWeekMonday(t);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const subtitle = `${weekStart.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
    })} - ${weekEnd.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })}`;

    return { label: 'Semanal', subtitle };
  }

  // monthly
  const subtitle = t.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });
  return { label: 'Mensual', subtitle };
};

const buildRangeStats = (
  range: TimeRange,
  today: Date,
  appointments: Appointment[],
  affiliates: Affiliate[]
): RangeStats => {
  const { label, subtitle } = formatRangeLabel(range, today);

  const rangeAppointments = appointments.filter((a) =>
    isInRange(a.date, range, today)
  );
  const recepcionados = rangeAppointments.filter(
    (a) => a.estado === 'recepcionado'
  );
  const cancelados = rangeAppointments.filter(
    (a) => a.estado === 'cancelado'
  );

  const totalTitulares = affiliates.filter((a) => a.esTitular === true).length;
  const totalAdherentes = affiliates.filter((a) => a.esTitular === false)
    .length;

  const planCounts = new Map<string, number>();
  PLAN_KEYS.forEach((p) => planCounts.set(p, 0));
  planCounts.set('OTROS', 0);

  recepcionados.forEach((a) => {
    const norm = normalizePlan(a.plan);
    if (!norm) return;
    const current = planCounts.get(norm) ?? 0;
    planCounts.set(norm, current + 1);
  });

  const plans: { label: string; value: number }[] = [
    ...PLAN_KEYS.map((p) => ({ label: p, value: planCounts.get(p) ?? 0 })),
  ];
  const otrosVal = planCounts.get('OTROS') ?? 0;
  if (otrosVal > 0) {
    plans.push({ label: 'Otros', value: otrosVal });
  }
  const prestadorCounts = new Map<string, number>();
  PRESTADORES.forEach((p) => prestadorCounts.set(p, 0));

  recepcionados.forEach((a) => {
    const key = a.prestador || 'Sin prestador';
    const current = prestadorCounts.get(key) ?? 0;
    prestadorCounts.set(key, current + 1);
  });

  const prestadores: { label: string; value: number }[] = [];
  PRESTADORES.forEach((p) => {
    prestadores.push({ label: p, value: prestadorCounts.get(p) ?? 0 });
  });

  const especialidadCounts = new Map<string, number>();
  recepcionados.forEach((a) => {
    if (a.tipoAtencion === 'especialidad' && a.especialidad) {
      const current = especialidadCounts.get(a.especialidad) ?? 0;
      especialidadCounts.set(a.especialidad, current + 1);
    }
  });

  let topEspecialidad: { label: string; value: number } | null = null;
  let worstEspecialidad: { label: string; value: number } | null = null;

  const especEntries = Array.from(especialidadCounts.entries());
  if (especEntries.length > 0) {
    especEntries.sort((a, b) => b[1] - a[1]);
    const [topLabel, topVal] = especEntries[0];
    const [worstLabel, worstVal] = especEntries[especEntries.length - 1];
    topEspecialidad = { label: topLabel, value: topVal };
    worstEspecialidad = { label: worstLabel, value: worstVal };
  }

  const labCounts = new Map<string, number>();
  recepcionados.forEach((a) => {
    if (a.tipoAtencion === 'laboratorio' && a.laboratorio) {
      const current = labCounts.get(a.laboratorio) ?? 0;
      labCounts.set(a.laboratorio, current + 1);
    }
  });

  let topLaboratorio: { label: string; value: number } | null = null;
  let worstLaboratorio: { label: string; value: number } | null = null;

  const labEntries = Array.from(labCounts.entries());
  if (labEntries.length > 0) {
    labEntries.sort((a, b) => b[1] - a[1]);
    const [topLabel, topVal] = labEntries[0];
    const [worstLabel, worstVal] = labEntries[labEntries.length - 1];
    topLaboratorio = { label: topLabel, value: topVal };
    worstLaboratorio = { label: worstLabel, value: worstVal };
  }

  return {
    range,
    label,
    subtitle,
    totalRecepcionados: recepcionados.length,
    totalCancelados: cancelados.length,
    plans,
    prestadores,
    topEspecialidad,
    worstEspecialidad,
    topLaboratorio,
    worstLaboratorio,
    totalTitulares,
    totalAdherentes,
  };
};

// === Card de stats reutilizable ===

interface StatsCardProps {
  stats: RangeStats;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ stats, className }) => {
  const totalTurnos = stats.totalRecepcionados + stats.totalCancelados;
  const cancelRate =
    totalTurnos > 0
      ? Math.round((stats.totalCancelados * 100) / totalTurnos)
      : 0;

  const totalAfiliados = stats.totalTitulares + stats.totalAdherentes;
  const adherentRate =
    totalAfiliados > 0
      ? Math.round((stats.totalAdherentes * 100) / totalAfiliados)
      : 0;

  return (
    <div className={`reports-card ${className ?? ''}`}>
      <header className="reports-card__header">
        <div>
          <h2 className="reports-card__title">{stats.label}</h2>
          <p className="reports-card__subtitle">{stats.subtitle}</p>
        </div>
      </header>

      <div className="reports-card__body">
        <div className="reports-card__totals">
          <div className="reports-kpi reports-kpi--good">
            <span className="reports-kpi__label">Recepcionados</span>
            <span className="reports-kpi__value">
              {stats.totalRecepcionados}
            </span>
            {totalTurnos > 0 && (
              <span className="reports-kpi__meta">
                {Math.round((stats.totalRecepcionados * 100) / totalTurnos)}% de
                los turnos
              </span>
            )}
          </div>

          <div className="reports-kpi reports-kpi--bad">
            <span className="reports-kpi__label">Cancelados</span>
            <span className="reports-kpi__value">
              {stats.totalCancelados}
            </span>
            {totalTurnos > 0 && (
              <span className="reports-kpi__meta">
                {cancelRate}% del total
              </span>
            )}
          </div>

          <div className="reports-kpi">
            <span className="reports-kpi__label">Titulares</span>
            <span className="reports-kpi__value">
              {stats.totalTitulares}
            </span>
            {totalAfiliados > 0 && (
              <span className="reports-kpi__meta">
                {Math.round(
                  (stats.totalTitulares * 100) / totalAfiliados
                )}
                % de afiliados
              </span>
            )}
          </div>

          <div className="reports-kpi">
            <span className="reports-kpi__label">Adherentes</span>
            <span className="reports-kpi__value">
              {stats.totalAdherentes}
            </span>
            {totalAfiliados > 0 && (
              <span className="reports-kpi__meta">
                {adherentRate}% de afiliados
              </span>
            )}
          </div>
        </div>

        <div className="reports-card__row">
          <div className="reports-card__column">
            <h3 className="reports-card__section-title">Por plan</h3>
            <ul className="reports-list">
              {stats.plans.map((p) => (
                <li
                  key={p.label}
                  className={
                    'reports-list__item' +
                    (p.value === 0 ? ' reports-list__item--empty' : '')
                  }
                >
                  <span className="reports-list__label">{p.label}</span>
                  <span className="reports-list__value">{p.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="reports-card__column">
            <h3 className="reports-card__section-title">Por prestador</h3>
            <ul className="reports-list">
              {stats.prestadores.map((p) => (
                <li
                  key={p.label}
                  className={
                    'reports-list__item' +
                    (p.value === 0 ? ' reports-list__item--empty' : '')
                  }
                >
                  <span className="reports-list__label">{p.label}</span>
                  <span className="reports-list__value">{p.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="reports-card__row reports-card__row--bottom">
          <div className="reports-card__column">
            <h3 className="reports-card__section-title">Especialidades</h3>
            <div className="reports-pill-group">
              <div className="reports-pill reports-pill--primary">
                <span className="reports-pill__label">Más recepcionada</span>
                <span className="reports-pill__value">
                  {stats.topEspecialidad
                    ? `${stats.topEspecialidad.label} (${stats.topEspecialidad.value})`
                    : 'Sin datos'}
                </span>
              </div>
              <div className="reports-pill">
                <span className="reports-pill__label">
                  Menos recepcionada
                </span>
                <span className="reports-pill__value">
                  {stats.worstEspecialidad
                    ? `${stats.worstEspecialidad.label} (${stats.worstEspecialidad.value})`
                    : 'Sin datos'}
                </span>
              </div>
            </div>
          </div>

          <div className="reports-card__column">
            <h3 className="reports-card__section-title">Laboratorio</h3>
            <div className="reports-pill-group">
              <div className="reports-pill reports-pill--primary">
                <span className="reports-pill__label">Más recepcionado</span>
                <span className="reports-pill__value">
                  {stats.topLaboratorio
                    ? `${stats.topLaboratorio.label} (${stats.topLaboratorio.value})`
                    : 'Sin datos'}
                </span>
              </div>
              <div className="reports-pill">
                <span className="reports-pill__label">
                  Menos recepcionado
                </span>
                <span className="reports-pill__value">
                  {stats.worstLaboratorio
                    ? `${stats.worstLaboratorio.label} (${stats.worstLaboratorio.value})`
                    : 'Sin datos'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// === Gráfico de barras  ===

interface ReportsBarChartProps {
  mode: 'mensual' | 'semanal';
  appointments: Appointment[];
}

const toISODate = (d: Date) => d.toISOString().slice(0, 10);

const ReportsBarChart: React.FC<ReportsBarChartProps> = ({
  mode,
  appointments,
}) => {
  const today = new Date();
  const recepcionados = appointments.filter((a) => a.estado === 'recepcionado');

  let data: { label: string; value: number }[] = [];

  if (mode === 'semanal') {
    const weekStart = startOfWeekMonday(today);
    const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    data = labels.map((label, idx) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + idx);
      const iso = toISODate(d);
      const value = recepcionados.filter((a) => a.date === iso).length;
      return { label, value };
    });
  } else {
    // mensual: 4 semanas
    const year = today.getFullYear();
    const month = today.getMonth();

    const weekBuckets = [0, 0, 0, 0]; 
    recepcionados.forEach((a) => {
      const d = parseISODate(a.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        const weekIndex = Math.min(3, Math.floor((day - 1) / 7));
        weekBuckets[weekIndex] += 1;
      }
    });

    const labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
    data = labels.map((label, idx) => ({
      label,
      value: weekBuckets[idx],
    }));
  }

  return (
    <div className="reports-chart">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 24, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar
            dataKey="value"
            radius={[6, 6, 0, 0]}
            fill="var(--color-primary, #008f6b)"
          >
            <LabelList dataKey="value" position="top" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="reports-chart__hint">
        Muestra la cantidad de turnos recepcionados por{' '}
        {mode === 'mensual'
          ? 'semana del mes actual'
          : 'día de la semana actual'}
        .
      </p>
    </div>
  );
};

// === Screen principal ===

interface ReportsScreenProps {
  appointments: Appointment[];
  affiliates: Affiliate[];
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  appointments,
  affiliates,
}) => {
  const today = new Date();
  const [chartMode, setChartMode] = useState<'mensual' | 'semanal'>('mensual');
  const [activeRange, setActiveRange] = useState<TimeRange>('monthly');

  const monthlyStats = buildRangeStats(
    'monthly',
    today,
    appointments,
    affiliates
  );
  const weeklyStats = buildRangeStats('weekly', today, appointments, affiliates);
  const dailyStats = buildRangeStats('daily', today, appointments, affiliates);

  const currentStats =
    activeRange === 'monthly'
      ? monthlyStats
      : activeRange === 'weekly'
      ? weeklyStats
      : dailyStats;

  return (
    <section className="reports-screen">
      <header className="reports-screen__header">
        <div>
          <h1 className="reports-screen__title">Reportes - Visualizá la actividad de turnos por día, semana y mes.</h1>
        </div>
      </header>
      <section className="card card--reports reports-screen__ranges-card">
        <header className="reports-screen__ranges-header">
          <div>
            <h2 className="reports-screen__chart-title">Resumen de turnos</h2>
            <p className="reports-screen__chart-subtitle">
              Desglose por plan, prestador, especialidades y laboratorio.
            </p>
          </div>

          <div className="reports-screen__chart-toggle">
            <button
              type="button"
              className={
                'reports-toggle-btn' +
                (activeRange === 'monthly'
                  ? ' reports-toggle-btn--active'
                  : '')
              }
              onClick={() => setActiveRange('monthly')}
            >
              Mensual
            </button>
            <button
              type="button"
              className={
                'reports-toggle-btn' +
                (activeRange === 'weekly'
                  ? ' reports-toggle-btn--active'
                  : '')
              }
              onClick={() => setActiveRange('weekly')}
            >
              Semanal
            </button>
            <button
              type="button"
              className={
                'reports-toggle-btn' +
                (activeRange === 'daily'
                  ? ' reports-toggle-btn--active'
                  : '')
              }
              onClick={() => setActiveRange('daily')}
            >
              Diario
            </button>
          </div>
        </header>

        <StatsCard stats={currentStats} />
      </section>

      {/* Gráfico */}
      <section className="card card--reports reports-screen__chart-card">
        <header className="reports-screen__chart-header">
          <div>
            <h2 className="reports-screen__chart-title">
              Actividad por días / semanas
            </h2>
            <p className="reports-screen__chart-subtitle">
              Visualizá los días más concurridos.
            </p>
          </div>

          <div className="reports-screen__chart-toggle">
            <button
              type="button"
              className={
                'reports-toggle-btn' +
                (chartMode === 'mensual'
                  ? ' reports-toggle-btn--active'
                  : '')
              }
              onClick={() => setChartMode('mensual')}
            >
              Mensual
            </button>
            <button
              type="button"
              className={
                'reports-toggle-btn' +
                (chartMode === 'semanal'
                  ? ' reports-toggle-btn--active'
                  : '')
              }
              onClick={() => setChartMode('semanal')}
            >
              Semanal
            </button>
          </div>
        </header>

        <ReportsBarChart mode={chartMode} appointments={appointments} />
      </section>
    </section>
  );
};
