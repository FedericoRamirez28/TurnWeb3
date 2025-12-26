import React, { useMemo, useState } from 'react';
import type { Affiliate, Appointment } from '@/components/screens/homeModels';
import { getTurnoDate } from '@/components/screens/homeModels';
import Swal from 'sweetalert2';
import { bajaAfiliadoApi } from '@/api/turnosApi';
import bajaIcon from '@/assets/icons/afiliado-baja.png';

interface AffiliatesScreenProps {
  affiliates: Affiliate[];
  appointments: Appointment[];
  onTakeAppointment: (affiliate: Affiliate) => void;
  onShowHistory: (affiliateId: string) => void;
}

// Helpers de fechas / turnos
const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const dateTimeFromAppointment = (a: Appointment): Date => {
  const fechaTurno = getTurnoDate(a);
  return new Date(`${fechaTurno}T${a.time}:00`);
};

const compareAppointments = (a: Appointment, b: Appointment) =>
  dateTimeFromAppointment(a).getTime() -
  dateTimeFromAppointment(b).getTime();

const formatAppointmentLabel = (a: Appointment) => {
  const fecha = formatDate(getTurnoDate(a));
  const practica =
    a.tipoAtencion === 'laboratorio'
      ? a.laboratorio ?? ''
      : a.especialidad ?? '';
  return `${fecha} · ${a.time} hs · ${practica || a.prestador}`;
};

type PlanClave = 'RUBI' | 'ESMERALDA' | 'BASE' | 'PARTICULAR' | 'DORADO';

const normalizarPlan = (planRaw?: string | null): PlanClave | null => {
  if (!planRaw) return null;
  const up = planRaw.toUpperCase();
  if (up.includes('DORADO')) return 'DORADO';
  if (up.includes('RUBI')) return 'RUBI';
  if (up.includes('ESMERALDA')) return 'ESMERALDA';
  if (up.includes('BASE')) return 'BASE';
  if (up.includes('PART')) return 'PARTICULAR';
  return null;
};

const PLAN_GROUPS: { key: PlanClave; label: string }[] = [
  { key: 'DORADO', label: 'DORADO' },
  { key: 'RUBI', label: 'RUBÍ' },
  { key: 'ESMERALDA', label: 'ESMERALDA' },
  { key: 'BASE', label: 'BASE' },
  { key: 'PARTICULAR', label: 'PARTICULAR' },
];

export const AffiliatesScreen: React.FC<AffiliatesScreenProps> = ({
  affiliates,
  appointments,
  onTakeAppointment,
  onShowHistory,
}) => {
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const filteredAffiliates = useMemo(
    () =>
      affiliates.filter((a) => {
        if (!normalizedQuery) return true;
        const blob = [
          a.nombreCompleto,
          a.dni,
          a.numeroAfiliado,
          a.telefono,
          a.email,
          a.plan,
          a.localidad,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(normalizedQuery);
      }),
    [affiliates, normalizedQuery],
  );

  const now = new Date();

  const getLastAndNext = (affiliateId: string) => {
    const list = appointments
      .filter((a) => a.affiliateId === affiliateId)
      .slice()
      .sort(compareAppointments);

    if (!list.length) return { last: null as Appointment | null, next: null };

    const past: Appointment[] = [];
    const future: Appointment[] = [];

    list.forEach((a) => {
      if (dateTimeFromAppointment(a) < now) {
        past.push(a);
      } else {
        future.push(a);
      }
    });

    return {
      last: past.length ? past[past.length - 1] : null,
      next: future.length ? future[0] : null,
    };
  };

  const handleDarDeBaja = async (affiliate: Affiliate) => {
    const result = await Swal.fire({
      title: 'Dar de baja afiliado',
      html: `¿Querés dar de baja a <strong>${affiliate.nombreCompleto}</strong>?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, dar de baja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    try {
      await bajaAfiliadoApi(affiliate.id);

      await Swal.fire({
        icon: 'success',
        title: 'Afiliado dado de baja',
        text: `${affiliate.nombreCompleto} fue dado de baja correctamente.`,
        timer: 1600,
        showConfirmButton: false,
      });

      window.location.reload();
    } catch (err) {
      console.error('Error dando de baja afiliado', err);
      await Swal.fire(
        'Error',
        'No se pudo dar de baja el afiliado. Intentá nuevamente.',
        'error',
      );
    }
  };

  return (
    <section className="affiliates-screen">
      <header className="affiliates-screen__header">
        <div>
          <h1 className="affiliates-screen__title">Afiliados</h1>
          <p className="affiliates-screen__subtitle">
            Visualizá la ficha completa y el historial de turnos.
          </p>
        </div>

        <div className="affiliates-screen__search">
          <input
            className="input affiliates-screen__search-input"
            placeholder="Buscar por nombre, DNI o Nº afiliado…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="affiliates-screen__plans-row">
        {PLAN_GROUPS.map((group) => {
          const planAffiliates = filteredAffiliates.filter(
            (a) => normalizarPlan(a.plan) === group.key,
          );

          return (
            <section
              key={group.key}
              className={`affiliates-screen__plan-column affiliates-screen__plan-column--${group.key.toLowerCase()}`}
            >
              <header className="affiliates-screen__plan-header">
                <h2 className="affiliates-screen__plan-title">
                  {group.label}
                </h2>
              </header>

              <div className="affiliates-screen__plan-body">
                {planAffiliates.length === 0 ? (
                  <p className="affiliates-screen__empty-plan">
                    Sin afiliados.
                  </p>
                ) : (
                  planAffiliates.map((a) => {
                    const { last, next } = getLastAndNext(a.id);

                    return (
                      <article
                        key={a.id}
                        className="card affiliates-screen__card affiliates-screen__card--hover"
                      >
                        <header className="affiliates-screen__card-header">
                          <div className="affiliates-screen__avatar">
                            {a.nombreCompleto.charAt(0).toUpperCase()}
                          </div>
                          <div className="affiliates-screen__card-title">
                            <h3>{a.nombreCompleto}</h3>
                            <div className="affiliates-screen__tags">
                              {a.plan && (
                                <span className="affiliates-screen__tag affiliates-screen__tag--plan">
                                  Plan: {a.plan}
                                </span>
                              )}
                              <span className="affiliates-screen__tag">
                                Nº {a.numeroAfiliado}
                              </span>
                              {a.esTitular != null && (
                                <span className="affiliates-screen__tag affiliates-screen__tag--role">
                                  {a.esTitular ? 'Titular' : 'Habilitado'}
                                </span>
                              )}
                            </div>
                          </div>
                        </header>

                        <div className="affiliates-screen__card-body">
                          <div className="affiliates-screen__info-block">
                            <h4>Datos personales</h4>
                            <p>
                              <span>DNI / CUIT:&nbsp;</span>
                              <strong>{a.dni}</strong>
                            </p>
                            {a.fechaNacimiento && (
                              <p>
                                <span>Nacimiento:&nbsp;</span>
                                {formatDate(a.fechaNacimiento)}
                              </p>
                            )}
                            {a.email && (
                              <p>
                                <span>Email:&nbsp;</span>
                                {a.email}
                              </p>
                            )}
                            {a.telefono && (
                              <p>
                                <span>Teléfono:&nbsp;</span>
                                {a.telefono}
                              </p>
                            )}
                          </div>

                          <div className="affiliates-screen__info-block">
                            <h4>Domicilio</h4>
                            {a.domicilio && (
                              <p>
                                <span>Calle:&nbsp;</span>
                                {a.domicilio}
                              </p>
                            )}
                            {(a.localidad || a.partido) && (
                              <p>
                                <span>Localidad / Partido:&nbsp;</span>
                                {[a.localidad, a.partido]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                            {(a.codigoPostal || a.provincia) && (
                              <p>
                                <span>CP / Provincia:&nbsp;</span>
                                {[a.codigoPostal, a.provincia]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="affiliates-screen__turnos">
                          <div className="affiliates-screen__turno">
                            <h5>Anterior</h5>
                            {last ? (
                              <>
                                <p className="affiliates-screen__turno-label">
                                  {formatAppointmentLabel(last)}
                                </p>
                                <p className="affiliates-screen__turno-meta">
                                  {last.tipoAtencion === 'laboratorio'
                                    ? last.laboratorio
                                    : last.especialidad}{' '}
                                  · {last.prestador}
                                </p>
                              </>
                            ) : (
                              <p className="affiliates-screen__turno-empty">
                                Sin turnos previos.
                              </p>
                            )}
                          </div>

                          <div className="affiliates-screen__turno">
                            <h5>Próximo</h5>
                            {next ? (
                              <>
                                <p className="affiliates-screen__turno-label">
                                  {formatAppointmentLabel(next)}
                                </p>
                                <p className="affiliates-screen__turno-meta">
                                  {next.tipoAtencion === 'laboratorio'
                                    ? next.laboratorio
                                    : next.especialidad}{' '}
                                  · {next.prestador}
                                </p>
                              </>
                            ) : (
                              <p className="affiliates-screen__turno-empty">
                                No hay turnos futuros.
                              </p>
                            )}
                          </div>
                        </div>

                        <footer className="affiliates-screen__card-footer">
                          <button
                            type="button"
                            title="Dar de baja afiliado"
                            onClick={() => void handleDarDeBaja(a)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              padding: 0,
                              marginRight: 8,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <img
                              src={bajaIcon}
                              alt="Dar de baja afiliado"
                              style={{ width: 28, height: 28 }}
                            />
                          </button>

                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() => onTakeAppointment(a)}
                          >
                            Tomar turno
                          </button>
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={() => onShowHistory(a.id)}
                          >
                            Ver historial
                          </button>
                        </footer>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {filteredAffiliates.length === 0 && (
        <p className="affiliates-screen__empty">
          No hay afiliados que coincidan con la búsqueda.
        </p>
      )}
    </section>
  );
};
