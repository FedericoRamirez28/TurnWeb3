export const APPOINTMENT_STATES = [
  'pendiente',
  'tomado',
  'recepcionado',
  'cancelado',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATES)[number];
