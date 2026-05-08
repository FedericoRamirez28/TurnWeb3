export type EfemerideAR = {
  month: number; // 0-11  (0 = enero)
  day: number;   // 1-31
  label: string;
  category?: 'salud' | 'educacion' | 'historica' | 'social' | 'otro';
};

export const EFEMERIDES_AR: EfemerideAR[] = [
  // ==== ENERO ====
  { month: 0, day: 4, label: 'Día Mundial del Braille', category: 'social' },
  { month: 0, day: 27, label: 'Día Internacional de Conmemoración en Memoria de las Víctimas del Holocausto', category: 'historica' },

  // ==== FEBRERO ====
  { month: 1, day: 4, label: 'Día Mundial contra el Cáncer', category: 'salud' },
  { month: 1, day: 11, label: 'Día Internacional de la Mujer y la Niña en la Ciencia', category: 'educacion' },
  { month: 1, day: 28, label: 'Día Mundial de las Enfermedades Poco Frecuentes', category: 'salud' },

  // ==== MARZO ====
  { month: 2, day: 8, label: 'Día Internacional de la Mujer', category: 'social' },
  { month: 2, day: 21, label: 'Día Internacional de la Eliminación de la Discriminación Racial', category: 'social' },
  { month: 2, day: 24, label: 'Día Nacional de la Memoria por la Verdad y la Justicia', category: 'historica' },

  // ==== ABRIL ====
  { month: 3, day: 2, label: 'Día del Veterano y de los Caídos en Malvinas', category: 'historica' },
  { month: 3, day: 7, label: 'Día Mundial de la Salud', category: 'salud' },
  { month: 3, day: 23, label: 'Día Mundial del Libro y del Derecho de Autor', category: 'educacion' },
  { month: 3, day: 30, label: 'Día Nacional de las Personas con Trastorno del Espectro Autista', category: 'salud' },

  // ==== MAYO ====
  { month: 4, day: 1, label: 'Día Internacional de las y los Trabajadores', category: 'social' },
  { month: 4, day: 3, label: 'Día Mundial de la Libertad de Prensa', category: 'social' },
  { month: 4, day: 28, label: 'Día Internacional de Acción por la Salud de las Mujeres', category: 'salud' },

  // ==== JUNIO ====
  { month: 5, day: 3, label: 'Día del Inmigrante Italiano', category: 'social' },
  { month: 5, day: 5, label: 'Día Mundial del Medio Ambiente', category: 'social' },
  { month: 5, day: 14, label: 'Día Nacional del Donante de Sangre', category: 'salud' },
  { month: 5, day: 20, label: 'Día de la Bandera (Belgrano)', category: 'historica' },

  // ==== JULIO ====
  { month: 6, day: 9, label: 'Día de la Independencia', category: 'historica' },
  { month: 6, day: 11, label: 'Día Mundial de la Población', category: 'social' },
  { month: 6, day: 28, label: 'Día Mundial de la Hepatitis', category: 'salud' },

  // ==== AGOSTO ====
  { month: 7, day: 1, label: 'Día Mundial de la Alegría', category: 'social' },
  { month: 7, day: 12, label: 'Día Internacional de la Juventud', category: 'social' },
  { month: 7, day: 17, label: 'Paso a la Inmortalidad de San Martín', category: 'historica' },
  { month: 7, day: 26, label: 'Día de los Abuelos', category: 'social' },

  // ==== SEPTIEMBRE ====
  { month: 8, day: 11, label: 'Día del Maestro', category: 'educacion' },
  { month: 8, day: 21, label: 'Día de la Primavera y del Estudiante', category: 'social' },
  { month: 8, day: 26, label: 'Día Mundial de Prevención del Embarazo No Intencional en la Adolescencia', category: 'salud' },
  { month: 8, day: 29, label: 'Día Mundial del Corazón', category: 'salud' },

  // ==== OCTUBRE ====
  { month: 9, day: 1, label: 'Día del Médico Veterinario Argentino', category: 'salud' },
  { month: 9, day: 12, label: 'Día del Respeto a la Diversidad Cultural', category: 'historica' },
  { month: 9, day: 16, label: 'Día Mundial de la Alimentación', category: 'salud' },
  { month: 9, day: 19, label: 'Día Mundial de Lucha contra el Cáncer de Mama', category: 'salud' },

  // ==== NOVIEMBRE ====
  { month: 10, day: 1, label: 'Día de todos los Santos', category: 'social' },
  { month: 10, day: 14, label: 'Día Mundial de la Diabetes', category: 'salud' },
  { month: 10, day: 20, label: 'Día de la Soberanía Nacional', category: 'historica' },
  { month: 10, day: 25, label: 'Día Internacional de la Eliminación de la Violencia contra la Mujer', category: 'social' },

  // ==== DICIEMBRE ====
  { month: 11, day: 1, label: 'Día Mundial de la Lucha contra el VIH/Sida', category: 'salud' },
  { month: 11, day: 3, label: 'Día Internacional de las Personas con Discapacidad', category: 'social' },
  { month: 11, day: 10, label: 'Día de los Derechos Humanos', category: 'social' },
];
