export type HighlightType = 'holiday' | 'efemeride';

export interface CalendarHighlight {
  date: string; // YYYY-MM-DD
  type: HighlightType;
  label: string;
}

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
};

const getEasterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Marzo,4=Abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const applyTrasladableRule = (date: Date): Date => {
  const wd = date.getDay(); 
  if (wd === 1) return date;

  if (wd === 2 || wd === 3) {
    const offset = 1 - wd; 
    return addDays(date, offset);
  }

  if (wd === 4 || wd === 5 || wd === 6 || wd === 0) {
    const offset = wd === 0 ? 1 : 8 - wd;
    return addDays(date, offset);
  }

  return date;
};

export const getArgentinaHolidays = (year: number): CalendarHighlight[] => {
  const holidays: CalendarHighlight[] = [];

  const toIso = (d: Date) => d.toISOString().slice(0, 10);

  const fixedInamovibles: { month: number; day: number; label: string }[] = [
    { month: 0, day: 1, label: 'Año Nuevo' }, 
    { month: 2, day: 24, label: 'Día de la Memoria' },
    { month: 3, day: 2, label: 'Malvinas' },
    { month: 4, day: 1, label: 'Día del Trabajador' },
    { month: 4, day: 25, label: 'Revolución de Mayo' },
    { month: 5, day: 20, label: 'Paso a la Inmortalidad de Belgrano' },
    { month: 6, day: 9, label: 'Día de la Independencia' },
    { month: 11, day: 8, label: 'Inmaculada Concepción' },
    { month: 11, day: 25, label: 'Navidad' },
  ];

  fixedInamovibles.forEach((h) => {
    holidays.push({
      date: toIso(new Date(year, h.month, h.day)),
      type: 'holiday',
      label: h.label,
    });
  });
  const easter = getEasterSunday(year);
  const carnivalMonday = addDays(easter, -48);
  const carnivalTuesday = addDays(easter, -47);
  const goodFriday = addDays(easter, -2);

  holidays.push(
    {
      date: toIso(carnivalMonday),
      type: 'holiday',
      label: 'Carnaval',
    },
    {
      date: toIso(carnivalTuesday),
      type: 'holiday',
      label: 'Carnaval',
    },
    {
      date: toIso(goodFriday),
      type: 'holiday',
      label: 'Viernes Santo',
    }
  );

  const trasladablesBase: { month: number; day: number; label: string }[] = [
    {
      month: 5,
      day: 17,
      label: 'Güemes',
    },
    {
      month: 7,
      day: 17,
      label: 'San Martín',
    },
    {
      month: 9,
      day: 12,
      label: 'Diversidad Cultural',
    },
    {
      month: 10,
      day: 20,
      label: 'Soberanía Nacional',
    },
  ];

  trasladablesBase.forEach((h) => {
    const baseDate = new Date(year, h.month, h.day);
    const observed = applyTrasladableRule(baseDate);

    holidays.push({
      date: toIso(observed),
      type: 'holiday',
      label: h.label,
    });
  });
  return holidays;
};

// === Efemérides (estáticas, editables) ===
const FIXED_EFEMERIDES: { month: number; day: number; label: string }[] = [
  { month: 2, day: 8, label: 'Día Internacional de la Mujer' },
  { month: 3, day: 7, label: 'Día Mundial de la Salud' },
  { month: 8, day: 21, label: 'Día de la Primavera' },
  { month: 8, day: 29, label: 'Día del Corazón' },
];

export const getCalendarHighlightsMap = (
  year: number
): Map<string, CalendarHighlight> => {
  const map = new Map<string, CalendarHighlight>();

  const holidays = getArgentinaHolidays(year);
  holidays.forEach((h) => {
    map.set(h.date, h);
  });

  FIXED_EFEMERIDES.forEach((e) => {
    const d = new Date(year, e.month, e.day).toISOString().slice(0, 10);
    if (!map.has(d)) {
      map.set(d, {
        date: d,
        type: 'efemeride',
        label: e.label,
      });
    }
  });

  return map;
};
