export const APPOINTMENT_STATES = [
  'pendiente',
  'tomado',
  'recepcionado',
  'cancelado',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATES)[number];

export const APPOINTMENT_PLANS = [
  'BASE',
  'ESMERALDA',
  'RUBI',
  'PARTICULAR',
  'DORADO',
  'PERSONAL',
] as const;

export type AppointmentPlan = (typeof APPOINTMENT_PLANS)[number];

export function normalizeAppointmentPlan(planRaw?: string | null): string {
  const raw = String(planRaw ?? '').trim();
  if (!raw) return '';

  const normalized = raw
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (normalized.includes('PERSONAL')) return 'PERSONAL';
  if (normalized.includes('DORADO')) return 'DORADO';
  if (normalized.includes('RUBI')) return 'RUBI';
  if (normalized.includes('ESMERALDA')) return 'ESMERALDA';
  if (normalized.includes('BASE')) return 'BASE';
  if (normalized.includes('PART')) return 'PARTICULAR';

  return raw;
}
