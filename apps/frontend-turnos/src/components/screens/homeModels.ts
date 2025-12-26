export type OccupancyLevel = 'low' | 'medium' | 'high';

export interface CalendarDay {
  date: string; 
  dayNumber: number;
  occupancy: OccupancyLevel | 'none';
}

// Datos del afiliado
export interface Affiliate {
  id: string;
  numeroAfiliado: string;
  nombreCompleto: string;
  dni: string;

  domicilio?: string;
  localidad?: string;
  codigoPostal?: string;
  partido?: string;
  provincia?: string;
  telefono?: string;
  telefonoAlt?: string;
  email?: string;
  fechaNacimiento?: string;
  esTitular?: boolean;
  plan?: string;

  proximoTurno?: string;
}

// Estado del turno
export type AppointmentStatus =
  | 'pendiente'
  | 'tomado'
  | 'recepcionado'
  | 'cancelado';

// Turno
export interface Appointment {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateDni?: string;      
  date: string;               
  controlDate?: string;       
  time: string;               

  tipoAtencion: 'especialidad' | 'laboratorio';
  especialidad?: string;
  laboratorio?: string;
  plan: string;
  prestador: string;
  monto: number;
  profesional: string;
  estado: AppointmentStatus;
}

export const getTurnoDate = (a: Appointment): string =>
  a.controlDate && a.controlDate.length > 0 ? a.controlDate : a.date;
