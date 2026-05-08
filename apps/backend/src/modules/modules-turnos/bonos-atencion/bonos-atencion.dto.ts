export type CreateBonoAtencionDto = {
  afiliadoId: string;
  prestadorId: string;
  turnoId?: string | null;

  practica: string;
  observaciones?: string | null;
  fechaAtencionISO?: string | null;

  // ISO string (opcional)
  expiresAt?: string | null;
};
