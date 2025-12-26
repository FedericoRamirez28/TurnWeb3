import React, { useMemo, useState, useCallback } from 'react';
import type { Affiliate } from '@/components/screens/homeModels';
import { geocodeAddress } from '@/utils/googleGeocode';
import Swal from 'sweetalert2';
import { bajaAfiliadoApi } from '@/api/turnosApi';
import bajaIcon from '@/assets/icons/afiliado-baja.png';

const PLAN_OPTIONS = ['BASE', 'ESMERALDA', 'RUBI', 'PARTICULAR', "DORADO"] as const;

export type AffiliateFormValues = {
  numeroAfiliado: string;
  dni: string;
  nombreCompleto: string;
  domicilio: string;
  localidad: string;
  codigoPostal: string;
  partido: string;
  provincia: string;
  telefono1: string;
  telefono2?: string;
  email: string;
  fechaNacimiento: string;
  esTitular: boolean;
  plan: string;
};

interface Props {
  affiliates: Affiliate[];
  onCreate: (values: AffiliateFormValues) => void;
  onUpdate: (id: string, values: AffiliateFormValues) => void;
  onTakeAppointment: (affiliate: Affiliate) => void;
}

const emptyForm: AffiliateFormValues = {
  numeroAfiliado: '',
  dni: '',
  nombreCompleto: '',
  domicilio: '',
  localidad: '',
  codigoPostal: '',
  partido: '',
  provincia: '',
  telefono1: '',
  telefono2: '',
  email: '',
  fechaNacimiento: '',
  esTitular: true,
  plan: '',
};

const affiliateToFormValues = (a: Affiliate): AffiliateFormValues => ({
  numeroAfiliado: a.numeroAfiliado || '',
  dni: a.dni || '',
  nombreCompleto: a.nombreCompleto || '',
  domicilio: a.domicilio || '',
  localidad: a.localidad || '',
  codigoPostal: a.codigoPostal || '',
  partido: a.partido || '',
  provincia: a.provincia || '',
  telefono1: a.telefono || '',
  telefono2: a.telefonoAlt || '',
  email: a.email || '',
  fechaNacimiento: a.fechaNacimiento || '',
  esTitular: typeof a.esTitular === 'boolean' ? a.esTitular : true,
  plan: a.plan || '',
});

export const AffiliatesQuickList: React.FC<Props> = ({
  affiliates,
  onCreate,
  onUpdate,
  onTakeAppointment,
}) => {
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditingSelected, setIsEditingSelected] = useState(false);

  const selectedAffiliate =
    selectedId != null
      ? affiliates.find((a) => a.id === selectedId) ?? null
      : null;

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return affiliates;
    return affiliates.filter((a) => {
      return (
        a.nombreCompleto.toLowerCase().includes(q) ||
        a.numeroAfiliado.toLowerCase().includes(q) ||
        a.dni.toLowerCase().includes(q) ||
        a.telefono?.toLowerCase().includes(q)
      );
    });
  }, [affiliates, query]);

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

      // Refrescamos la UI rápido
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
    <>
      <section className="card card--stretch">
        <header className="card__header">
          <div>
            <h2 className="card__title">Cartilla de afiliados</h2>
            <p className="card__subtitle">
              Buscá afiliados y tomá turnos rápidamente.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setIsCreateOpen(true)}
            >
              + Nuevo afiliado
            </button>
          </div>
        </header>

        <div className="affiliates">
          <div className="affiliates__search">
            <input
              type="text"
              className="input"
              placeholder="Buscar por nombre, DNI o Nº afiliado…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="affiliates__list">
            {filtered.map((a) => (
              <article key={a.id} className="affiliate-card">
                <div className="affiliate-card__avatar">
                  {a.nombreCompleto.charAt(0)}
                </div>

                <div className="affiliate-card__body">
                  <div className="affiliate-card__row">
                    <span className="affiliate-card__name">
                      {a.nombreCompleto}
                    </span>
                    <span className="affiliate-card__number">
                      Nº {a.numeroAfiliado}
                    </span>
                  </div>
                  <div className="affiliate-card__row affiliate-card__row--meta">
                    <span>DNI / CUIT: {a.dni}</span>
                    {a.plan && <span>Plan: {a.plan}</span>}
                  </div>
                  <div className="affiliate-card__row affiliate-card__row--meta">
                    {a.telefono && <span>Tel: {a.telefono}</span>}
                    {typeof a.esTitular === 'boolean' && (
                      <span>{a.esTitular ? 'Titular' : 'Habilitado'}</span>
                    )}
                  </div>
                  {a.proximoTurno && (
                    <div className="affiliate-card__row affiliate-card__row--meta">
                      <span className="affiliate-card__next">
                        Próximo turno:{' '}
                        {new Date(a.proximoTurno).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="affiliate-card__actions">
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
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setSelectedId(a.id);
                      setIsEditingSelected(false);
                    }}
                  >
                    Ver ficha
                  </button>
                </div>
              </article>
            ))}

            {filtered.length === 0 && (
              <p className="affiliates__empty">
                No se encontraron afiliados para “{query}”.
              </p>
            )}
          </div>
        </div>
      </section>
      {isCreateOpen && (
        <AffiliateModal
          mode="create"
          initialValues={emptyForm}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={(values) => {
            onCreate(values);
            setIsCreateOpen(false);
          }}
        />
      )}

      {selectedAffiliate && !isEditingSelected && (
        <AffiliateDetailModal
          affiliate={selectedAffiliate}
          onClose={() => setSelectedId(null)}
          onEdit={() => setIsEditingSelected(true)}
          onTakeAppointment={(affiliateForTurno) => {
            onTakeAppointment(affiliateForTurno);
            setSelectedId(null);
          }}
        />
      )}

      {selectedAffiliate && isEditingSelected && (
        <AffiliateModal
          mode="edit"
          initialValues={affiliateToFormValues(selectedAffiliate)}
          onClose={() => {
            setIsEditingSelected(false);
            setSelectedId(null);
          }}
          onSubmit={(values) => {
            onUpdate(selectedAffiliate.id, values);
            setIsEditingSelected(false);
            setSelectedId(null);
          }}
        />
      )}
    </>
  );
};

interface AffiliateModalProps {
  mode: 'create' | 'edit';
  initialValues: AffiliateFormValues;
  onClose: () => void;
  onSubmit: (values: AffiliateFormValues) => void;
}

const AffiliateModal: React.FC<AffiliateModalProps> = ({
  mode,
  initialValues,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState<AffiliateFormValues>(initialValues);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleChange =
    (field: keyof AffiliateFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value =
        field === 'esTitular'
          ? (e.target as HTMLInputElement).checked
          : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleGeocodeClick = useCallback(async () => {
    if (isGeocoding) return;

    setGeoMessage(null);
    setGeoError(null);

    const missing: string[] = [];
    if (!form.domicilio.trim()) missing.push('domicilio');
    if (!form.localidad.trim()) missing.push('localidad');

    if (missing.length > 0) {
      setGeoError(
        `Para validar el domicilio completá: ${missing.join(', ')}.`
      );
      return;
    }

    setIsGeocoding(true);

    try {
      const result = await geocodeAddress(
        form.domicilio,
        form.localidad,
        form.provincia
      );

      if (!result) {
        setGeoError(
          'No pudimos validar el domicilio. Revisá los datos o completá a mano.'
        );
        return;
      }

      console.log('Resultado Geocoding:', result);

      setForm((prev) => ({
        ...prev,
        domicilio:
          result.calle && result.numero
            ? `${result.calle} ${result.numero}`
            : prev.domicilio,
        localidad: result.localidad ?? prev.localidad,
        partido: result.partido ?? prev.partido,
        provincia: result.provincia ?? prev.provincia,
        codigoPostal: result.codigoPostal ?? prev.codigoPostal,
      }));

      setGeoMessage('Domicilio validado y completado con Google Maps.');
    } catch (err) {
      console.error(err);
      setGeoError(
        'Ocurrió un error consultando Google Maps. Intentá nuevamente más tarde.'
      );
    } finally {
      setIsGeocoding(false);
    }
  }, [form.domicilio, form.localidad, form.provincia, isGeocoding]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="affiliates-modal-overlay">
      <div className="affiliates-modal">
        <header className="affiliates-modal__header">
          <h2 className="affiliates-modal__title">
            {mode === 'create' ? 'Nuevo afiliado' : 'Editar afiliado'}
          </h2>
          <button
            type="button"
            className="affiliates-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <form className="affiliates-modal__body" onSubmit={handleSubmit}>
          <div className="affiliates-modal__grid">
            <label className="field">
              <span className="field__label">Código / Nº afiliado</span>
              <input
                className="input"
                value={form.numeroAfiliado}
                onChange={handleChange('numeroAfiliado')}
                required
              />
            </label>

            <label className="field">
              <span className="field__label">DNI / CUIT</span>
              <input
                className="input"
                value={form.dni}
                onChange={handleChange('dni')}
                required
              />
            </label>

            <label className="field field--full">
              <span className="field__label">Nombre / Razón social</span>
              <input
                className="input"
                value={form.nombreCompleto}
                onChange={handleChange('nombreCompleto')}
                required
              />
            </label>

            {/* Bloque de domicilio + botón de autocompletar */}
            <label className="field field--full">
              <div className="field__label-row">
                <span className="field__label">Domicilio</span>
                <button
                  type="button"
                  className="field__action-link"
                  onClick={handleGeocodeClick}
                  disabled={isGeocoding}
                >
                  {isGeocoding ? 'Validando…' : 'Completar con Google Maps'}
                </button>
              </div>
              <input
                className="input"
                value={form.domicilio}
                onChange={handleChange('domicilio')}
                placeholder="Calle y número (ej: Viamonte 430)"
              />
              {geoMessage && (
                <span className="field__hint">{geoMessage}</span>
              )}
              {geoError && (
                <span className="field__hint field__hint--error">
                  {geoError}
                </span>
              )}
            </label>

            <label className="field">
              <span className="field__label">Localidad</span>
              <input
                className="input"
                value={form.localidad}
                onChange={handleChange('localidad')}
                placeholder="Ej: Ramos Mejía"
              />
            </label>

            <label className="field">
              <span className="field__label">Código postal</span>
              <input
                className="input"
                value={form.codigoPostal}
                onChange={handleChange('codigoPostal')}
                placeholder="Se completa al validar, o escribilo"
              />
            </label>

            <label className="field">
              <span className="field__label">Partido</span>
              <input
                className="input"
                value={form.partido}
                onChange={handleChange('partido')}
                placeholder="Se completa al validar, o escribilo"
              />
            </label>

            <label className="field">
              <span className="field__label">Provincia</span>
              <input
                className="input"
                value={form.provincia}
                onChange={handleChange('provincia')}
                placeholder="Ej: Buenos Aires"
              />
            </label>

            <label className="field">
              <span className="field__label">Teléfono 1</span>
              <input
                className="input"
                value={form.telefono1}
                onChange={handleChange('telefono1')}
              />
            </label>

            <label className="field">
              <span className="field__label">Teléfono 2 (opcional)</span>
              <input
                className="input"
                value={form.telefono2}
                onChange={handleChange('telefono2')}
              />
            </label>

            <label className="field field--full">
              <span className="field__label">Email</span>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={handleChange('email')}
              />
            </label>

            <label className="field">
              <span className="field__label">Fecha de nacimiento</span>
              <input
                type="date"
                className="input"
                value={form.fechaNacimiento}
                onChange={handleChange('fechaNacimiento')}
              />
            </label>

            <label className="field">
              <span className="field__label">Plan vigente</span>
              <select
                className="input"
                value={form.plan}
                onChange={handleChange('plan')}
              >
                <option value="">Seleccionar plan…</option>
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field--checkbox field--full">
              <input
                type="checkbox"
                checked={form.esTitular}
                onChange={handleChange('esTitular')}
              />
              <span className="field__label">
                Es titular (destildar si es habilitado)
              </span>
            </label>
          </div>

          <footer className="affiliates-modal__footer">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary">
              {mode === 'create' ? 'Guardar afiliado' : 'Guardar cambios'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

interface AffiliateDetailModalProps {
  affiliate: Affiliate;
  onClose: () => void;
  onEdit: () => void;
  onTakeAppointment: (affiliate: Affiliate) => void;
}

const AffiliateDetailModal: React.FC<AffiliateDetailModalProps> = ({
  affiliate,
  onClose,
  onEdit,
  onTakeAppointment,
}) => {
  return (
    <div className="affiliates-modal-overlay">
      <div className="affiliates-modal affiliates-modal--read">
        <header className="affiliates-modal__header">
          <div className="affiliates-modal__header-main">
            <div className="affiliate-card__avatar affiliate-card__avatar--lg">
              {affiliate.nombreCompleto.charAt(0)}
            </div>
            <div>
              <h2 className="affiliates-modal__title">
                {affiliate.nombreCompleto}
              </h2>
              <p className="affiliates-modal__subtitle">
                Nº afiliado: {affiliate.numeroAfiliado}{' '}
                {typeof affiliate.esTitular === 'boolean' && (
                  <>· {affiliate.esTitular ? 'Titular' : 'Habilitado'}</>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="affiliates-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="affiliates-modal__body affiliates-modal__body--scroll">
          <div className="affiliates-sheet">
            <section className="affiliates-sheet__section">
              <h3 className="affiliates-sheet__title">Datos personales</h3>
              <div className="affiliates-sheet__grid">
                <InfoRow label="DNI / CUIT" value={affiliate.dni} />
                <InfoRow
                  label="Fecha de nacimiento"
                  value={affiliate.fechaNacimiento}
                />
                <InfoRow label="Plan vigente" value={affiliate.plan} />
                <InfoRow
                  label="Tipo"
                  value={
                    typeof affiliate.esTitular === 'boolean'
                      ? affiliate.esTitular
                        ? 'Titular'
                        : 'Habilitado'
                      : ''
                  }
                />
              </div>
            </section>

            <section className="affiliates-sheet__section">
              <h3 className="affiliates-sheet__title">Contacto</h3>
              <div className="affiliates-sheet__grid">
                <InfoRow label="Teléfono 1" value={affiliate.telefono} />
                <InfoRow label="Teléfono 2" value={affiliate.telefonoAlt} />
                <InfoRow label="Email" value={affiliate.email} />
              </div>
            </section>

            <section className="affiliates-sheet__section">
              <h3 className="affiliates-sheet__title">Domicilio</h3>
              <div className="affiliates-sheet__grid affiliates-sheet__grid--full">
                <InfoRow label="Domicilio" value={affiliate.domicilio} />
                <InfoRow label="Localidad" value={affiliate.localidad} />
                <InfoRow
                  label="Código postal"
                  value={affiliate.codigoPostal}
                />
                <InfoRow label="Partido" value={affiliate.partido} />
                <InfoRow label="Provincia" value={affiliate.provincia} />
              </div>
            </section>

            {affiliate.proximoTurno && (
              <section className="affiliates-sheet__section">
                <h3 className="affiliates-sheet__title">Próximo turno</h3>
                <p className="affiliates-sheet__highlight">
                  {new Date(affiliate.proximoTurno).toLocaleString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </section>
            )}
          </div>
        </div>

        <footer className="affiliates-modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn btn--outline" onClick={onEdit}>
            Modificar datos
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onTakeAppointment(affiliate)}
          >
            Tomar turno
          </button>
        </footer>
      </div>
    </div>
  );
};

interface InfoRowProps {
  label: string;
  value?: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="affiliates-info-row">
      <span className="affiliates-info-row__label">{label}</span>
      <span className="affiliates-info-row__value">{value}</span>
    </div>
  );
};
