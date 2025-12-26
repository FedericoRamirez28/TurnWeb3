import React, { useState, useMemo } from 'react';
import {
  type Appointment,
  getTurnoDate,
} from '@/components/screens/homeModels';
import Holidays from 'date-holidays';
import {
  EFEMERIDES_AR,
  type EfemerideAR,
} from '@/components/constant/efemeridesAR';

const WEEK_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface Props {
  appointments: Appointment[];
  selectedDate: string;
  onSelectDay: (date: string) => void;
}

type HighlightType = 'holiday' | 'efemeride';

// Helper para obtener la fecha local en formato YYYY-MM-DD
// Evita que a la noche (GMT-3) se marque el día siguiente
const getLocalISOString = (d = new Date()) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

// Helper para crear fecha local segura desde string (evita UTC shift)
const safeLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  // Agregamos T00:00:00 para forzar interpretación local en la mayoría de los navegadores
  // O bien usamos split para crear el objeto Date manualmente
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const getMonthMatrix = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const startWeekDay = (firstDay.getDay() + 6) % 7; // lunes = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const matrix: { date: string; dayNumber: number | null }[] = [];
  const totalCells = 42; // 6 semanas

  for (let i = 0; i < totalCells; i += 1) {
    const dayNumber = i - startWeekDay + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      matrix.push({ date: '', dayNumber: null });
    } else {
      // Construimos fecha local pura
      const date = new Date(year, month, dayNumber);
      const iso = getLocalISOString(date);
      matrix.push({ date: iso, dayNumber });
    }
  }

  return matrix;
};

type HolidayItem = {
  date: string;
  name: string;
  type: string;
};

// Feriados + efemérides
const buildHighlightsMap = (year: number) => {
  const map = new Map<string, { type: HighlightType; label: string }>();

  const hd = new Holidays('AR');
  hd.setLanguages('es');

  const feriados = hd.getHolidays(year) as HolidayItem[];

  feriados.forEach((f) => {
    if (f.type !== 'public' && f.type !== 'bank') return;
    const iso = f.date.slice(0, 10);
    if (!iso) return;

    map.set(iso, {
      type: 'holiday',
      label: f.name,
    });
  });

  EFEMERIDES_AR.forEach((e: EfemerideAR) => {
    // Usamos new Date local
    const iso = getLocalISOString(new Date(year, e.month, e.day));
    if (!map.has(iso)) {
      map.set(iso, {
        type: 'efemeride',
        label: e.label,
      });
    }
  });

  return map;
};

export const CalendarPanel: React.FC<Props> = ({
  appointments,
  selectedDate,
  onSelectDay,
}) => {
  const today = new Date();
  const todayISO = getLocalISOString(today);

  // Inicializar vista basada en selectedDate (local) o today
  const initialBase = selectedDate ? safeLocalDate(selectedDate) : today;
  const [viewYear, setViewYear] = useState(initialBase.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialBase.getMonth());

  const cells = useMemo(
    () => getMonthMatrix(viewYear, viewMonth),
    [viewYear, viewMonth]
  );
  
  const highlights = useMemo(
    () => buildHighlightsMap(viewYear),
    [viewYear]
  );

  // Mapa de ocupación que guarda conteo y horarios
  const occupancyMap = useMemo(() => {
    const map = new Map<string, { count: number; times: string[] }>();
    
    appointments.forEach((a) => {
      if (a.estado === 'cancelado') return;
      
      const rawDate = getTurnoDate(a); // Puede venir '2025-10-10' o ISO full
      if (!rawDate) return;
      
      const isoDate = rawDate.slice(0, 10); // Aseguramos YYYY-MM-DD
      const timeStr = a.time || ''; // Asumimos que 'a' tiene propiedad 'time' (ej: '10:50')

      const prev = map.get(isoDate) || { count: 0, times: [] };
      
      map.set(isoDate, {
        count: prev.count + 1,
        times: [...prev.times, timeStr].filter(Boolean)
      });
    });

    return map;
  }, [appointments]);

  const getOccupancyClass = (date: string | '') => {
    if (!date) return 'none';
    const data = occupancyMap.get(date);
    const count = data?.count ?? 0;
    
    if (count === 0) return 'none';
    if (count <= 3) return 'low';
    if (count <= 6) return 'medium';
    return 'high';
  };

  const visibleMonthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    'es-AR',
    { month: 'long', year: 'numeric' }
  );

  const goPrevMonth = () => {
    setViewMonth((prev) => {
      if (prev === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const goNextMonth = () => {
    setViewMonth((prev) => {
      if (prev === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  return (
    <section className="card card--stretch">
      <header className="card__header">
        <div>
          <h2 className="card__title">Calendario de turnos</h2>
          <p className="card__subtitle">
            Visualizá los días ocupados y libres.
          </p>
        </div>
        <div className="calendar__header-actions">
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={goPrevMonth}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <span className="calendar__month-label">
            {visibleMonthLabel.charAt(0).toUpperCase() +
              visibleMonthLabel.slice(1)}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--xs"
            onClick={goNextMonth}
            aria-label="Mes siguiente"
          >
            ›
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--xs calendar__today-btn"
            onClick={goToday}
          >
            Hoy
          </button>
        </div>
      </header>

      <div className="calendar">
        <div className="calendar__weekdays">
          {WEEK_DAYS.map((d, idx) => (
            <span key={`${d}-${idx}`} className="calendar__weekday">
              {d}
            </span>
          ))}
        </div>

        <div className="calendar__grid">
          {cells.map((cell, idx) => {
            const occupancy = getOccupancyClass(cell.date);
            const isSelected = cell.date === selectedDate;
            const isToday = cell.date === todayISO;
            const highlight = cell.date ? highlights.get(cell.date) : undefined;
            const info = cell.date ? occupancyMap.get(cell.date) : undefined;

            // Generamos el tooltip (title)
            let titleText = '';
            if (highlight) titleText += `${highlight.label}\n`;
            if (info && info.count > 0) {
              const sortedTimes = info.times.sort();
              titleText += `Turnos (${info.count}):\n${sortedTimes.join(', ')}`;
            }

            if (!cell.dayNumber) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="calendar__day calendar__day--empty"
                />
              );
            }

            return (
              <button
                key={cell.date}
                type="button"
                className={[
                  'calendar__day',
                  `calendar__day--${occupancy}`,
                  isSelected ? 'calendar__day--selected' : '',
                  isToday ? 'calendar__day--today' : '',
                  highlight ? `calendar__day--${highlight.type}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => cell.date && onSelectDay(cell.date)}
                title={titleText.trim() || undefined}
              >
                <span className="calendar__day-number">
                  {cell.dayNumber}
                </span>

                {highlight && (
                  <span
                    className={[
                      'calendar__tag',
                      `calendar__tag--${highlight.type}`,
                    ].join(' ')}
                  >
                    {highlight.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <footer className="calendar__legend">
        <span className="calendar__legend-item">
          <span className="calendar__dot calendar__dot--low" /> Pocos turnos
        </span>
        <span className="calendar__legend-item">
          <span className="calendar__dot calendar__dot--medium" /> Medio
        </span>
        <span className="calendar__legend-item">
          <span className="calendar__dot calendar__dot--high" /> Casi completo
        </span>
        <span className="calendar__legend-item">
          <span className="calendar__tag-sample calendar__tag-sample--holiday" />{' '}
          Feriado
        </span>
        <span className="calendar__legend-item">
          <span className="calendar__tag-sample calendar__tag-sample--efemeride" />{' '}
          Efeméride
        </span>
      </footer>
    </section>
  );
};