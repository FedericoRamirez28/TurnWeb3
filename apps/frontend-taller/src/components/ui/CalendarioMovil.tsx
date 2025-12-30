import React, { useEffect, useMemo, useState } from "react";


type Prioridad = "baja" | "alta" | "urgente";

type Evento = {
  fecha: string; // YYYY-MM-DD
  prioridad?: string | null;
  prioridad_cache?: string | null;
  prio?: string | null;
  p?: string | null;
  [k: string]: any;
};

type Props = {
  movilId?: string | number | null;
  onSelectDate?: (iso: string, dayEvents: Evento[]) => void;
  refreshToken?: number;
};

function normalizePriority(ev: Evento): Prioridad | "" {
  const pr = String(
    ev?.prioridad ?? ev?.prioridad_cache ?? ev?.prio ?? ev?.p ?? ""
  )
    .trim()
    .toLowerCase();

  if (pr === "urgente" || pr === "alta" || pr === "baja") return pr;
  return "";
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);

const PR_WEIGHT: Record<Prioridad, number> = { baja: 1, alta: 2, urgente: 3 };

function pickMaxPriority(arr: Evento[]): Prioridad {
  let best: Prioridad = "baja";
  let bestW = -1;

  for (const ev of arr) {
    const p = (normalizePriority(ev) || "baja") as Prioridad;
    const w = PR_WEIGHT[p] ?? 1;
    if (w > bestW) {
      best = p;
      bestW = w;
    }
  }
  return best;
}

export default function CalendarioMovil({
  movilId,
  onSelectDate,
  refreshToken = 0,
}: Props) {
  const API =
    (import.meta as any)?.env?.VITE_TALLER_API_BASE_URL ||
    (import.meta as any)?.env?.VITE_API_BASE ||
    "http://localhost:3003";

  const [current, setCurrent] = useState<Date>(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);

  const from = useMemo(() => toISO(startOfMonth(current)), [current]);
  const to = useMemo(() => toISO(endOfMonth(current)), [current]);

  const eventosByDay = useMemo(() => {
    const map = new Map<string, Evento[]>();
    eventos.forEach((ev) => {
      const arr = map.get(ev.fecha) || [];
      arr.push(ev);
      map.set(ev.fecha, arr);
    });
    return map;
  }, [eventos]);

  useEffect(() => {
    if (!movilId) return;

    let abort = false;

    (async () => {
      try {
        setLoading(true);
        const url = `${API}/moviles/${encodeURIComponent(
          String(movilId)
        )}/calendario?from=${from}&to=${to}`;

        const res = await fetch(url);
        const json = await res.json();

        const list: Evento[] = Array.isArray(json) ? json : (json?.data || []);
        if (!abort) setEventos(list);
      } catch (e) {
        console.error("CalendarioMovil fetch error:", e);
        if (!abort) setEventos([]);
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [movilId, from, to, API, refreshToken]);

  const weeks = useMemo(() => {
    const first = startOfMonth(current);
    const last = endOfMonth(current);
    const firstWeekday = (first.getDay() + 7) % 7;

    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      cells.push(new Date(current.getFullYear(), current.getMonth(), d));
    }

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [current]);

  const monthLabel = useMemo(
    () =>
      current.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      }),
    [current]
  );

  return (
    <div className="ts-calendar">
      <div className="ts-calendar__header">
        <button className="ts-btn" onClick={() => setCurrent((p) => addMonths(p, -1))}>
          «
        </button>

        <strong className="title-calendar">{monthLabel}</strong>

        <button className="ts-btn" onClick={() => setCurrent((p) => addMonths(p, +1))}>
          »
        </button>
      </div>

      <div className="ts-calendar__grid">
        {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d, i) => (
          <div key={i} className="ts-calendar__dow">
            {d}
          </div>
        ))}

        {weeks.map((row, ri) => (
          <div className="ts-calendar__row" key={ri}>
            {row.map((date, di) => {
              if (!date) {
                return (
                  <div
                    className="ts-calendar__cell ts-calendar__cell--empty"
                    key={di}
                  />
                );
              }

              const iso = toISO(date);
              const dayEvents = eventosByDay.get(iso) || [];
              const has = dayEvents.length > 0;
              const isToday = iso === toISO(new Date());

              const dayPriority = has ? pickMaxPriority(dayEvents) : null;
              const dotClass = dayPriority
                ? `ts-calendar__dot ts-calendar__dot--${dayPriority}`
                : "ts-calendar__dot ts-calendar__dot--default";

              return (
                <button
                  key={di}
                  className={`ts-calendar__cell ${isToday ? "is-today" : ""} ${
                    has ? "has-events" : ""
                  }`}
                  onClick={() => onSelectDate?.(iso, dayEvents)}
                  title={has ? "Tiene eventos" : ""}
                >
                  <div className="ts-calendar__date">{date.getDate()}</div>
                  {has && <div className={dotClass} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {loading && <div className="ts-calendar__loading">Cargando…</div>}
    </div>
  );
}
