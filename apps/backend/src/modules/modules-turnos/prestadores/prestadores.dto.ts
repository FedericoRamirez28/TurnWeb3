export type CreatePrestadorDto = {
  username: string;
  password: string;
  displayName?: string;

  nombre: string;
  razonSocial?: string | null;
  cuit?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
};
