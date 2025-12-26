import React, { useMemo, useState } from 'react';
import {
  type Appointment,
  type Affiliate,
  getTurnoDate,
} from '@/components/screens/homeModels';
import Swal from 'sweetalert2';
import filterPng from '@/assets/icons/filter.png';
import escobaPng from '@/assets/icons/escoba.png';
import minusPng from '@/assets/icons/minus.png';
import trashPng from '@/assets/icons/trash-gradient.png';

type TodaySummaryStats = {
  turnosHoy: number;
  enEspera: number;
  cancelados: number;
  sinConfirmar: number;
};

interface TodaySummaryProps {
  stats: TodaySummaryStats;
  appointments: Appointment[];
  affiliates: Affiliate[];
  onRecepcionar: (appointmentId: string) => void;
  onCancelar: (appointmentId: string) => void;
}

// Helper para obtener la fecha local YYYY-MM-DD
// Corrige el bug de timezone que marcaba mañana como hoy a la noche.
const getLocalISOString = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

const formatDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const getEstadoLabel = (estado: Appointment['estado']) => {
  switch (estado) {
    case 'pendiente':
      return 'Pendiente';
    case 'tomado':
      return 'Tomado';
    case 'recepcionado':
      return 'Recepcionado';
    case 'cancelado':
      return 'Cancelado';
    default:
      return estado;
  }
};

const getEstadoClass = (estado: Appointment['estado']) => {
  switch (estado) {
    case 'recepcionado':
      return 'summary__status summary__status--recepcionado';
    case 'cancelado':
      return 'summary__status summary__status--cancelado';
    case 'tomado':
      return 'summary__status summary__status--tomado';
    case 'pendiente':
    default:
      return 'summary__status summary__status--pendiente';
  }
};

type FiltersState = {
  afiliado: string;
  dni: string;
  profesional: string;
  prestador: string;
  practica: string;
  estado: '' | Appointment['estado'];
};

const INITIAL_FILTERS: FiltersState = {
  afiliado: '',
  dni: '',
  profesional: '',
  prestador: '',
  practica: '',
  estado: '',
};
const PRUNE_KEY = 'medic_todaySummary_pruneBeforeISO';

export const TodaySummary: React.FC<TodaySummaryProps> = ({
  stats,
  appointments,
  affiliates,
  onRecepcionar,
  onCancelar,
}) => {
  // CORRECCIÓN AQUÍ: Usamos getLocalISOString en lugar de new Date().toISOString()
  const todayISO = getLocalISOString();

  const [pruneBeforeISO, setPruneBeforeISO] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PRUNE_KEY);
    } catch {
      return null;
    }
  });

  const isPruneActive = Boolean(pruneBeforeISO);

  const handlePrunePast = async () => {
    // Usamos getTurnoDate(a).slice(0, 10) para comparar peras con peras
    const pastCount = appointments.filter((a) => (getTurnoDate(a) || '').slice(0, 10) < todayISO)
      .length;

    if (pastCount === 0) {
      await Swal.fire({
        icon: 'info',
        title: 'No hay turnos pasados',
        text: 'No se encontraron turnos con fecha anterior a hoy.',
        timer: 1400,
        showConfirmButton: false,
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Ocultar turnos pasados',
      html: `Esto va a <strong>ocultar</strong> ${pastCount} turnos cuya fecha es anterior a <strong>${formatDate(
        todayISO
      )}</strong>.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      buttonsStyling: false,
      customClass: {
        popup: 'swal-popup',
        title: 'swal-title',
        htmlContainer: 'swal-text',
        confirmButton: 'btn btn--primary',
        cancelButton: 'btn btn--ghost',
      },
    });

    if (!result.isConfirmed) return;

    setPruneBeforeISO(todayISO);
    try {
      localStorage.setItem(PRUNE_KEY, todayISO);
    } catch { /* empty */ }

    await Swal.fire({
      icon: 'success',
      title: 'Listo',
      text: 'Se han ocultado correctamente',
      timer: 1400,
      showConfirmButton: false,
    });
  };
  const handleUndoPrune = async () => {
    setPruneBeforeISO(null);
    try {
      localStorage.removeItem(PRUNE_KEY);
    } catch { /* empty */ }

    await Swal.fire({
      icon: 'success',
      title: 'Restaurado',
      text: 'Volviste a mostrar los turnos pasados.',
      timer: 1200,
      showConfirmButton: false,
    });
  };

  const affiliateById = useMemo(
    () => new Map(affiliates.map((a) => [a.id, a] as const)),
    [affiliates]
  );

  const cleanedAppointments = useMemo(() => {
    if (!pruneBeforeISO) return appointments;
    return appointments.filter((a) => (getTurnoDate(a) || '').slice(0, 10) >= pruneBeforeISO);
  }, [appointments, pruneBeforeISO]);

  // Filtramos solo los que coinciden con hoy
  const todayAppointments = cleanedAppointments.filter((a) => (a.date || '').slice(0, 10) === todayISO);
  
  const sortedAppointments = todayAppointments
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time));

  const uniqueProfesionales = Array.from(
    new Set(sortedAppointments.map((a) => a.profesional).filter(Boolean))
  );
  const uniquePrestadores = Array.from(
    new Set(sortedAppointments.map((a) => a.prestador).filter(Boolean))
  );
  const uniquePracticas = Array.from(
    new Set(
      sortedAppointments
        .map((a) =>
          a.tipoAtencion === 'laboratorio' ? a.laboratorio : a.especialidad
        )
        .filter(Boolean)
    )
  );

  // Filtros
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const handleCancelarClick = (id: string) => {
    Swal.fire({
      title: 'Cancelar turno',
      text: '¿Querés cancelar el siguiente turno?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Volver',
      reverseButtons: true,
      focusCancel: true,
      buttonsStyling: false,
      customClass: {
        popup: 'swal-popup',
        title: 'swal-title',
        htmlContainer: 'swal-text',
        confirmButton: 'btn btn--danger',
        cancelButton: 'btn btn--ghost',
      },
    }).then((result) => {
      if (result.isConfirmed) onCancelar(id);
    });
  };

  const handleChangeFilter = (key: keyof FiltersState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilter = (key: keyof FiltersState) => {
    setFilters((prev) => ({ ...prev, [key]: '' }));
  };

  const clearAllFilters = () => setFilters(INITIAL_FILTERS);

  const textIncludes = (haystack: string | undefined, needle: string) => {
    if (!needle.trim()) return true;
    if (!haystack) return false;
    return haystack.toLowerCase().includes(needle.toLowerCase());
  };

  const filteredAppointments = sortedAppointments.filter((a) => {
    const affiliate = affiliateById.get(a.affiliateId);
    const dni = affiliate?.dni ?? '';

    if (!textIncludes(a.affiliateName, filters.afiliado)) return false;
    if (!textIncludes(dni, filters.dni)) return false;
    if (!textIncludes(a.profesional, filters.profesional)) return false;

    if (
      filters.prestador &&
      a.prestador.toLowerCase() !== filters.prestador.toLowerCase()
    ) {
      return false;
    }

    const practica =
      a.tipoAtencion === 'laboratorio' ? a.laboratorio : a.especialidad;
    if (!textIncludes(practica || '', filters.practica)) return false;

    if (filters.estado && a.estado !== filters.estado) return false;

    return true;
  });

  const MAX_VISIBLE = 15;
  const visibleAppointments =
    filteredAppointments.length > MAX_VISIBLE
      ? filteredAppointments.slice(-MAX_VISIBLE)
      : filteredAppointments;

  const activeFilterChips: { key: keyof FiltersState; label: string }[] = [];

  if (filters.afiliado) activeFilterChips.push({ key: 'afiliado', label: `Afiliado: ${filters.afiliado}` });
  if (filters.dni) activeFilterChips.push({ key: 'dni', label: `DNI/CUIT: ${filters.dni}` });
  if (filters.profesional) activeFilterChips.push({ key: 'profesional', label: `Profesional: ${filters.profesional}` });
  if (filters.prestador) activeFilterChips.push({ key: 'prestador', label: `Prestador: ${filters.prestador}` });
  if (filters.practica) activeFilterChips.push({ key: 'practica', label: `Práctica: ${filters.practica}` });
  if (filters.estado) activeFilterChips.push({ key: 'estado', label: `Estado: ${getEstadoLabel(filters.estado)}` });

  return (
    <section className="summary card card--stretch">
      <header className="card__header summary__header">
        <div>
          <h2 className="card__title">Recepción de turnos y confirmación</h2>
          <p className="card__subtitle">
            Visualizá los turnos cargados para hoy, recepcionalos o cancelalos según corresponda.
          </p>
        </div>

        <div className="summary__toolbar">
          {activeFilterChips.length > 0 && (
            <div className="summary__chips">
              {activeFilterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="summary__chip"
                  onClick={() => clearFilter(chip.key)}
                >
                  <span>{chip.label}</span>
                  <span className="summary__chip-icon">
                    <img
                      src={minusPng}
                      alt="Quitar filtro"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className={`summary__clean-btn ${isPruneActive ? 'summary__clean-btn--active' : ''}`}
            onClick={() => void handlePrunePast()}
            title="Limpiar turnos pasados (fecha < hoy)"
          >
            <img
              src={escobaPng}
              alt="Limpiar turnos pasados"
              className="summary__clean-icon"
            />
          </button>
          <span
            onContextMenu={(e) => {
              e.preventDefault();
              if (isPruneActive) void handleUndoPrune();
            }}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="summary__filter-btn"
            onClick={() => setFiltersOpen((v) => !v)}
            title="Filtros"
          >
            <img
              src={filterPng}
              alt="Filtros"
              className="summary__filter-icon"
            />
          </button>
          {filtersOpen && (
            <div className="summary__filter-popover">
              <div className="summary__filter-popover-inner">
                <div className="summary__filter-popover-header">
                  <span className="summary__filter-popover-title">Filtros</span>
                  <button
                    type="button"
                    className="summary__filter-popover-close"
                    onClick={() => setFiltersOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <div className="summary__filter-grid">
                  <label className="summary__filter-field">
                    <span>Afiliado</span>
                    <input
                      className="input"
                      value={filters.afiliado}
                      onChange={(e) => handleChangeFilter('afiliado', e.target.value)}
                      placeholder="Nombre / apellido…"
                    />
                  </label>

                  <label className="summary__filter-field">
                    <span>DNI / CUIT</span>
                    <input
                      className="input"
                      value={filters.dni}
                      onChange={(e) => handleChangeFilter('dni', e.target.value)}
                      placeholder="Documento…"
                    />
                  </label>

                  <label className="summary__filter-field">
                    <span>Profesional</span>
                    <select
                      className="input"
                      value={filters.profesional}
                      onChange={(e) => handleChangeFilter('profesional', e.target.value)}
                    >
                      <option value="">Todos</option>
                      {uniqueProfesionales.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="summary__filter-field">
                    <span>Prestador</span>
                    <select
                      className="input"
                      value={filters.prestador}
                      onChange={(e) => handleChangeFilter('prestador', e.target.value)}
                    >
                      <option value="">Todos</option>
                      {uniquePrestadores.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="summary__filter-field">
                    <span>Práctica</span>
                    <select
                      className="input"
                      value={filters.practica}
                      onChange={(e) => handleChangeFilter('practica', e.target.value)}
                    >
                      <option value="">Todas</option>
                      {uniquePracticas.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="summary__filter-field">
                    <span>Estado</span>
                    <select
                      className="input"
                      value={filters.estado}
                      onChange={(e) =>
                        handleChangeFilter('estado', e.target.value as FiltersState['estado'])
                      }
                    >
                      <option value="">Todos</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="tomado">Tomado</option>
                      <option value="recepcionado">Recepcionado</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </label>
                </div>

                <div className="summary__filter-popover-footer">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={clearAllFilters}>
                    Limpiar filtros
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => setFiltersOpen(false)}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Stats */}
      <div className="summary__stats">
        <article className="summary-card">
          <div className="summary-card__label">Turnos totales</div>
          <span className="summary-card__value">{stats.turnosHoy}</span>
        </article>
        <article className="summary-card">
          <div className="summary-card__label">Recepcionados</div>
          <span className="summary-card__value">{stats.enEspera}</span>
        </article>
        <article className="summary-card">
          <div className="summary-card__label">Cancelados</div>
          <span className="summary-card__value">{stats.cancelados}</span>
        </article>
        <article className="summary-card">
          <div className="summary-card__label">Sin confirmar</div>
          <span className="summary-card__value">{stats.sinConfirmar}</span>
        </article>
      </div>

      {/* Tabla */}
      <div className="summary__table-wrapper">
        {visibleAppointments.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--color-ink-soft)' }}>
            Hoy todavía no hay turnos cargados.
          </p>
        ) : (
          <table className="summary-table">
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Afiliado</th>
                <th>DNI / CUIT</th>
                <th>Profesional</th>
                <th>Prestador</th>
                <th>Práctica</th>
                <th>Monto</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleAppointments.map((a) => {
                const turnoDate = getTurnoDate(a);
                const opDate = a.date;
                const affiliate = affiliateById.get(a.affiliateId);
                const dni = affiliate?.dni ?? '';

                const practica =
                  a.tipoAtencion === 'laboratorio' ? a.laboratorio : a.especialidad;

                const prestadorDisplay = a.prestador;
                const montoDisplay = a.monto > 0 ? `$ ${a.monto.toFixed(2)}` : 'Sin costo';

                const isCancelado = a.estado === 'cancelado';

                return (
                  <tr
                    key={a.id}
                    className={isCancelado ? 'summary__row summary__row--cancelado' : 'summary__row'}
                  >
                    <td>
                      <div>
                        <strong>
                          {formatDate(turnoDate)} · {a.time} hs
                        </strong>
                      </div>
                      {turnoDate !== opDate && (
                        <div className="summary-table__sub">
                          Tomado el {formatDate(opDate)}
                        </div>
                      )}
                    </td>
                    <td>{a.affiliateName}</td>
                    <td>{dni}</td>
                    <td>{a.profesional}</td>
                    <td>{prestadorDisplay}</td>
                    <td>{practica ?? ''}</td>
                    <td>{montoDisplay}</td>
                    <td>
                      <span className={getEstadoClass(a.estado)}>
                        {getEstadoLabel(a.estado)}
                      </span>
                    </td>
                    <td>
                      <div className="summary-table__actions">
                        {a.estado !== 'cancelado' && (
                          <button
                            type="button"
                            className="btn-icon btn-icon--danger"
                            onClick={() => handleCancelarClick(a.id)}
                            title="Cancelar turno"
                          >
                            <img
                              src={trashPng}
                              alt="Cancelar"
                              width={18}
                              height={18}
                            />
                          </button>
                        )}
                        {a.estado !== 'recepcionado' && a.estado !== 'cancelado' && (
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() => onRecepcionar(a.id)}
                          >
                            Recepcionar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};