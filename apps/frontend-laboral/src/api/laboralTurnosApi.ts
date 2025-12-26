// src/api/laboralTurnosApi.ts
// ✅ Listo para copiar/pegar. Sin localStorage. Compatible con tu fetchJSON y tu backend actual.

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;

  if (!res.ok) {
    const obj =
      typeof data === 'object' && data !== null
        ? (data as Record<string, unknown>)
        : null;
    const msg =
      (obj && typeof obj.message === 'string' && obj.message) ||
      (obj && typeof obj.error === 'string' && obj.error) ||
      `Error ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export type SedeKey = 'caba' | 'sanjusto';

export type LaborTurno = {
  id: string;
  sede: SedeKey;

  empresa: string;
  companyId: string;
  employeeId: string;

  nombre: string;
  dni: string;
  nroAfiliado: string;
  puesto: string;

  fechaRecepcionISO: string;
  fechaTurnoISO: string;
  tipoExamen: string;

  createdAt: string;
};

export type CreateLaborTurnoInput = {
  sede: SedeKey;
  empresa: string;
  nombre: string;
  dni: string;
  nroAfiliado?: string;
  puesto: string;
  tipoExamen: string;
  fechaRecepcionISO: string;
  fechaTurnoISO: string;
};

type BackendCreateResponse = {
  turno: {
    id: string;
    sede: SedeKey;
    fechaRecepcionISO: string;
    fechaTurnoISO: string;
    tipoExamen: string;
    createdAt: string;
    company: { id: string; nombre: string };
    employee: {
      id: string;
      dni: string;
      nombre: string;
      nroAfiliado: string | null;
      puesto: string | null;
    };
  };
};

type BackendListResponse = { turnos: LaborTurno[] };

function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, '');
}

function apiUrl(path: string) {
  const base = stripTrailingSlash(API_BASE_URL || '');
  if (!base) return path;
  if (path.startsWith('http')) return path;
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

function mapCreateTurnoToLaborTurno(t: BackendCreateResponse['turno']): LaborTurno {
  return {
    id: t.id,
    sede: t.sede,
    empresa: t.company?.nombre ?? '',
    companyId: t.company?.id ?? '',
    employeeId: t.employee?.id ?? '',
    nombre: t.employee?.nombre ?? '',
    dni: t.employee?.dni ?? '',
    nroAfiliado: t.employee?.nroAfiliado ?? '',
    puesto: t.employee?.puesto ?? '',
    fechaRecepcionISO: t.fechaRecepcionISO,
    fechaTurnoISO: t.fechaTurnoISO,
    tipoExamen: t.tipoExamen,
    createdAt: t.createdAt,
  };
}

export async function laboralTurnoCreate(
  input: CreateLaborTurnoInput,
): Promise<LaborTurno> {
  const r = await fetchJSON<BackendCreateResponse>(apiUrl('/laboral/turnos'), {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return mapCreateTurnoToLaborTurno(r.turno);
}

export async function laboralTurnosList(params?: {
  q?: string;
  from?: string;
  to?: string;
  month?: string; // YYYY-MM
}): Promise<LaborTurno[]> {
  const qs = new URLSearchParams();

  if (params?.q?.trim()) qs.set('q', params.q.trim());
  if (params?.from?.trim()) qs.set('from', params.from.trim());
  if (params?.to?.trim()) qs.set('to', params.to.trim());
  if (params?.month?.trim()) qs.set('month', params.month.trim());

  const url = apiUrl(`/laboral/turnos${qs.toString() ? `?${qs.toString()}` : ''}`);
  const r = await fetchJSON<BackendListResponse>(url);
  return Array.isArray(r.turnos) ? r.turnos : [];
}
