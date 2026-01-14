import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { TopNavbar, type NavKey } from '@/components/ui/home/TopNavbar'
import { CalendarPanel } from '@/components/ui/home/CalendarPanel'
import { CierreCajaScreen } from '@/components/screens/CierreCajaScreen'
import { ReportsScreen } from '@/components/screens/ReportsScreen'
import Swal from 'sweetalert2'

import {
  AffiliatesQuickList,
  type AffiliateFormValues,
} from '@/components/ui/home/AffiliateQuicklist'
import { TodaySummary } from '@/components/ui/home/TodaySummary'
import { AffiliatesScreen } from '@/components/screens/AffiliatesScreen'

import {
  type Affiliate,
  type Appointment,
  type AppointmentStatus,
  getTurnoDate,
} from '@/components/screens/homeModels'

import {
  fetchInitialData,
  createAffiliate,
  updateAffiliateApi,
  saveTurno,
  cancelarTurnoApi,
} from '@/api/turnosApi'

import trashGradient from '@/assets/icons/trash-gradient.png'
import { useTurnosPrices } from '@/hooks/useTurnoPrices'

import BonoAtencionScreen from '@/components/screens/BonosAtencionScreen'



// === catálogos básicos ===

const PLAN_OPTIONS = ['BASE', 'ESMERALDA', 'RUBI', 'PARTICULAR', 'DORADO'] as const

const PRESTADORES = [
  'VITAS',
  'CEPEM',
  'DOCTORES MOLINAS',
  'SIGMA',
  'TESLA',
  'TC HAEDO',
  'MEDIC',
] as const

const MEDIC_PROFESIONALES = ['Dr. Viano', 'Dra. Quevedo', 'Dra. Ramos'] as const

// === Helpers de fechas/horarios ===

const dateTimeFromAppointment = (a: Appointment): Date =>
  new Date(`${getTurnoDate(a)}T${a.time}:00`)

const compareAppointments = (a: Appointment, b: Appointment) =>
  dateTimeFromAppointment(a).getTime() - dateTimeFromAppointment(b).getTime()

// Ajuste para evitar problemas de timezone en la fecha de hoy
const getLocalISOString = () => {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

const withNextTurno = (affiliates: Affiliate[], appointments: Appointment[]): Affiliate[] => {
  const appointmentsByAffiliate = new Map<string, Appointment[]>()

  appointments.forEach((a) => {
    const arr = appointmentsByAffiliate.get(a.id) ?? appointmentsByAffiliate.get(a.affiliateId) ?? []
    // ↑ compat por si alguna vez cambió shape; tu data real usa affiliateId
    arr.push(a)
    appointmentsByAffiliate.set(a.affiliateId, arr)
  })

  const now = new Date()

  return affiliates.map((a) => {
    const list = (appointmentsByAffiliate.get(a.id) ?? []).slice()
    if (list.length === 0) return { ...a, proximoTurno: undefined }

    const future = list.filter((appt) => {
      if (appt.estado === 'cancelado') return false
      const dt = dateTimeFromAppointment(appt)
      return dt >= now
    })

    if (future.length === 0) return { ...a, proximoTurno: undefined }

    future.sort(compareAppointments)
    const next = future[0]
    const turnoDate = getTurnoDate(next)
    const proximoTurnoISO = `${turnoDate}T${next.time}:00`

    return { ...a, proximoTurno: proximoTurnoISO }
  })
}

export const HomeScreen: React.FC = () => {
  const [selectedNav, setSelectedNav] = useState<NavKey>('home')

  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)

  const prices = useTurnosPrices()

  const affiliatesWithNext = useMemo(
    () => withNextTurno(affiliates, appointments),
    [affiliates, appointments],
  )

  const [selectedAffiliateForTurno, setSelectedAffiliateForTurno] = useState<Affiliate | null>(null)
  const [selectedAppointmentForTurno, setSelectedAppointmentForTurno] = useState<Appointment | null>(
    null,
  )

  const [turnoMode, setTurnoMode] = useState<'tomar' | 'recepcionar'>('tomar')
  const [selectedDate, setSelectedDate] = useState<string>(getLocalISOString())
  const [calendarSidebarOpen, setCalendarSidebarOpen] = useState(false)

  const [selectedTimeForNewTurno, setSelectedTimeForNewTurno] = useState<string | null>(null)

  const [historyAffiliateId, setHistoryAffiliateId] = useState<string | null>(null)

  const refreshData = useCallback(async () => {
    setLoading(true)
    try {
      const { affiliates: affs, appointments: appts } = await fetchInitialData()
      setAffiliates(affs)
      setAppointments(appts)
    } catch (err) {
      console.error('Error cargando datos iniciales', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  // === Afiliados ===

  const handleCreateAffiliate = (values: AffiliateFormValues) => {
    void createAffiliate(values)
      .then((created) => setAffiliates((prev) => [...prev, created]))
      .catch((err) => console.error('Error creando afiliado', err))
  }

  const handleUpdateAffiliate = (id: string, values: AffiliateFormValues) => {
    void updateAffiliateApi(id, values)
      .then((updated) => setAffiliates((prev) => prev.map((a) => (a.id === id ? updated : a))))
      .catch((err) => console.error('Error actualizando afiliado', err))
  }

  // === Turnos ===

  const handleOpenTurnoModalFromAffiliate = (affiliate: Affiliate) => {
    setSelectedAffiliateForTurno(affiliate)
    setSelectedAppointmentForTurno(null)
    setTurnoMode('tomar')
    setSelectedTimeForNewTurno(null)
  }

  const handleAffiliateSelectedForTimeSlot = (affiliate: Affiliate) => {
    setSelectedAffiliateForTurno(affiliate)
    setSelectedAppointmentForTurno(null)
    setTurnoMode('tomar')
  }

  const handleOpenRecepcionarFromToday = (appointmentId: string) => {
    const appt = appointments.find((a) => a.id === appointmentId)
    if (!appt) return

    const affiliate = affiliatesWithNext.find((a) => a.id === appt.affiliateId) ?? null

    setSelectedAffiliateForTurno(affiliate)
    setSelectedAppointmentForTurno(appt)
    setTurnoMode('recepcionar')
    setSelectedDate(getTurnoDate(appt))
    setSelectedTimeForNewTurno(null)
  }

  const handleCloseTurnoModal = () => {
    setSelectedAffiliateForTurno(null)
    setSelectedAppointmentForTurno(null)
    setSelectedTimeForNewTurno(null)
  }

  const handleSaveAppointment = (payload: {
    id?: string
    affiliateId: string
    date: string
    controlDate?: string
    time: string
    tipoAtencion: 'especialidad' | 'laboratorio'
    especialidad?: string
    laboratorio?: string
    plan: string
    prestador: string
    monto: number
    profesional: string
    estado: AppointmentStatus
  }) => {
    void saveTurno(payload)
      .then(() => refreshData())
      .catch((err) => console.error('Error guardando turno', err))
  }

  const handleCancelarTurno = (appointmentId: string) => {
    void cancelarTurnoApi(appointmentId)
      .then(() => refreshData())
      .catch((err) => console.error('Error cancelando turno', err))
  }

  const handleDeleteTurnoFromSidebar = (appointmentId: string) => {
    void Swal.fire({
      title: 'Eliminar turno',
      text: '¿Seguro que querés eliminar este turno? Se marcará como cancelado.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: 'var(--color-danger, #ef4444)',
      cancelButtonColor: 'var(--color-border, #cbd5e1)',
    }).then((result) => {
      if (!result.isConfirmed) return

      void cancelarTurnoApi(appointmentId)
        .then(() => {
          void Swal.fire({
            title: 'Listo',
            text: 'El turno fue eliminado.',
            icon: 'success',
            timer: 1200,
            showConfirmButton: false,
          })
          void refreshData()
        })
        .catch((err) => {
          console.error('Error cancelando turno', err)
          void Swal.fire({
            title: 'Error',
            text: 'No se pudo eliminar el turno. Intentá nuevamente.',
            icon: 'error',
            confirmButtonText: 'Cerrar',
          })
        })
    })
  }

  const todayAppointments = appointments.filter((a) => a.date === getLocalISOString())

  const todayStats = useMemo(() => {
    const total = todayAppointments.length
    const cancelados = todayAppointments.filter((a) => a.estado === 'cancelado').length
    const recepcionados = todayAppointments.filter((a) => a.estado === 'recepcionado').length
    const pendientes = todayAppointments.filter(
      (a) => a.estado === 'pendiente' || a.estado === 'tomado',
    ).length

    return {
      turnosHoy: total,
      enEspera: recepcionados,
      cancelados,
      sinConfirmar: pendientes,
    }
  }, [todayAppointments])

  const handleSelectDayFromCalendar = (date: string) => {
    setSelectedDate(date)
    setCalendarSidebarOpen(true)
  }

  const appointmentsForSelectedDay = useMemo(
    () =>
      appointments
        .filter((a) => getTurnoDate(a) === selectedDate && a.estado !== 'cancelado')
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, selectedDate],
  )

  const isSlotTaken = useCallback(
    (date: string, time: string) =>
      appointments.some(
        (a) => getTurnoDate(a) === date && a.time === time && a.estado !== 'cancelado',
      ),
    [appointments],
  )

  // === LÓGICA PARA GENERAR LOS SLOTS DE LA SIDEBAR ===
  const sidebarSlots = useMemo(() => {
    const baseSlots = Array.from({ length: 24 }, (_, idx) => {
      const hour = 8 + Math.floor(idx / 2)
      const minute = idx % 2 === 0 ? '00' : '30'
      return `${hour.toString().padStart(2, '0')}:${minute}`
    })

    const existingTimes = appointmentsForSelectedDay.map((a) => a.time)
    const uniqueTimes = new Set([...baseSlots, ...existingTimes])
    return Array.from(uniqueTimes).sort()
  }, [appointmentsForSelectedDay])
  // ===================================================

  const historyAffiliate = historyAffiliateId
    ? affiliatesWithNext.find((a) => a.id === historyAffiliateId) ?? null
    : null

  const historyAppointments = useMemo(
    () =>
      historyAffiliate
        ? appointments
            .filter((a) => a.affiliateId === historyAffiliate.id)
            .slice()
            .sort((a, b) => compareAppointments(b, a))
        : [],
    [historyAffiliate, appointments],
  )

  return (
    <div className="home">
      <TopNavbar selected={selectedNav} onSelect={setSelectedNav} />

      <main className="home__main">
        {selectedNav === 'home' && (
          <>
            <section className="home__top">
              <div className="home__calendar-panel">
                <CalendarPanel
                  appointments={appointments}
                  selectedDate={selectedDate}
                  onSelectDay={handleSelectDayFromCalendar}
                />
              </div>

              <div className="home__affiliates-panel">
                <AffiliatesQuickList
                  affiliates={affiliatesWithNext}
                  onCreate={handleCreateAffiliate}
                  onUpdate={handleUpdateAffiliate}
                  onTakeAppointment={handleOpenTurnoModalFromAffiliate}
                />
              </div>
            </section>

            <section className="home__bottom">
              <TodaySummary
                stats={todayStats}
                appointments={appointments}
                affiliates={affiliatesWithNext}
                onRecepcionar={handleOpenRecepcionarFromToday}
                onCancelar={handleCancelarTurno}
              />
            </section>

            {loading && (
              <div className="home__loading-overlay">
                <div className="home__loading-pill">Cargando datos desde el servidor…</div>
              </div>
            )}
          </>
        )}

        {selectedNav === 'afiliados' && (
          <AffiliatesScreen
            affiliates={affiliatesWithNext}
            appointments={appointments}
            onTakeAppointment={handleOpenTurnoModalFromAffiliate}
            onShowHistory={(id) => setHistoryAffiliateId(id)}
          />
        )}

        {selectedNav === 'reportes' && (
          <ReportsScreen appointments={appointments} affiliates={affiliatesWithNext} />
        )}

        {selectedNav === 'caja' && (
          <CierreCajaScreen appointments={appointments} affiliates={affiliatesWithNext} />
        )}

        {selectedNav === 'bono' && (
  <BonoAtencionScreen affiliates={affiliatesWithNext} />
)}


        {selectedNav !== 'home' &&
          selectedNav !== 'afiliados' &&
          selectedNav !== 'reportes' &&
          selectedNav !== 'caja' &&
          selectedNav !== 'bono' && (
            <section className="home__placeholder">
              <div className="home__placeholder-card card">
                <h2 className="card__title">Próximamente</h2>
                <p className="card__subtitle">Esta sección todavía no está implementada.</p>
              </div>
            </section>
          )}
      </main>

      {/* SIDEBAR DEL CALENDARIO */}
      {selectedNav === 'home' && calendarSidebarOpen && (
        <div className="calendar-sidebar">
          <div className="calendar-sidebar__panel">
            <header className="calendar-sidebar__header">
              <div>
                <h3 className="calendar-sidebar__title">Turnos del {selectedDate}</h3>
                <p className="calendar-sidebar__subtitle">
                  Seleccioná un horario libre para tomar un turno.
                </p>
              </div>
              <button
                type="button"
                className="calendar-sidebar__close"
                onClick={() => setCalendarSidebarOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="calendar-sidebar__body">
              <ul className="calendar-sidebar__slots">
                {sidebarSlots.map((time) => {
                  const appt = appointmentsForSelectedDay.find((a) => a.time === time)
                  const taken = Boolean(appt)

                  return (
                    <li
                      key={time}
                      className={`calendar-sidebar__slot ${
                        taken ? 'calendar-sidebar__slot--taken' : 'calendar-sidebar__slot--free'
                      }`}
                    >
                      <div className="calendar-sidebar__slot-time">{time}</div>

                      <div className="calendar-sidebar__slot-info">
                        {taken && appt ? (
                          <div className="calendar-sidebar__slot-taken">
                            <div className="calendar-sidebar__slot-text">
                              <div className="calendar-sidebar__slot-name">{appt.affiliateName}</div>
                              <div className="calendar-sidebar__slot-meta">
                                {appt.tipoAtencion === 'laboratorio'
                                  ? appt.laboratorio
                                  : appt.especialidad}{' '}
                                · {appt.profesional}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="calendar-sidebar__trash"
                              title="Eliminar turno"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTurnoFromSidebar(appt.id)
                              }}
                            >
                              <img src={trashGradient} alt="Eliminar" />
                            </button>
                          </div>
                        ) : (
                          <div className="calendar-sidebar__slot-free-actions">
                            <span className="calendar-sidebar__slot-meta">Libre</span>
                            <button
                              type="button"
                              className="btn btn--xs btn--outline"
                              onClick={() => setSelectedTimeForNewTurno(time)}
                              title="Tomar turno en este horario"
                              style={{ marginLeft: 'auto' }}
                            >
                              + Tomar
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECTOR DE AFILIADO (INTERMEDIO) */}
      {selectedTimeForNewTurno && !selectedAffiliateForTurno && (
        <div className="turno-modal-overlay">
          <div
            className="turno-modal"
            style={{ maxWidth: '600px', height: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <header className="turno-modal__header">
              <div>
                <h2 className="turno-modal__title">Seleccionar Afiliado</h2>
                <p className="turno-modal__subtitle">
                  Para el turno del <b>{selectedDate}</b> a las <b>{selectedTimeForNewTurno}</b>
                </p>
              </div>
              <button
                type="button"
                className="turno-modal__close"
                onClick={() => setSelectedTimeForNewTurno(null)}
              >
                ×
              </button>
            </header>

            <div style={{ flex: 1, overflow: 'hidden', padding: '1rem', background: '#f8fafc' }}>
              <AffiliatesQuickList
                affiliates={affiliatesWithNext}
                onCreate={handleCreateAffiliate}
                onUpdate={handleUpdateAffiliate}
                onTakeAppointment={handleAffiliateSelectedForTimeSlot}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CARGA DE TURNO */}
      {selectedAffiliateForTurno && (
        <TurnoModal
          mode={turnoMode}
          affiliate={selectedAffiliateForTurno}
          defaultDate={selectedDate}
          initialTime={selectedTimeForNewTurno}
          appointment={selectedAppointmentForTurno ?? undefined}
          onClose={handleCloseTurnoModal}
          onSave={handleSaveAppointment}
          isSlotTaken={isSlotTaken}
          laboratorioOptions={prices.laboratorioOptions}
          especialidadesOptions={prices.especialidadesOptions}
          getLaboratorioPrice={prices.getLaboratorioPrice}
          getEspecialidadPrice={prices.getEspecialidadPrice}
          pricesLoading={prices.loading}
          pricesError={prices.error}
        />
      )}

      {selectedNav === 'afiliados' && historyAffiliate && (
        <AffiliateHistoryModal
          affiliate={historyAffiliate}
          appointments={historyAppointments}
          onClose={() => setHistoryAffiliateId(null)}
        />
      )}
    </div>
  )
}


interface AffiliateHistoryModalProps {
  affiliate: Affiliate
  appointments: Appointment[]
  onClose: () => void
}

const AffiliateHistoryModal: React.FC<AffiliateHistoryModalProps> = ({
  affiliate,
  appointments,
  onClose,
}) => {
  const formatDate = (iso: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
  }

  return (
    <div className="affiliate-history-modal__overlay">
      <div className="affiliate-history-modal">
        <header className="affiliate-history-modal__header">
          <div>
            <h2 className="affiliate-history-modal__title">Historial de turnos</h2>
            <p className="affiliate-history-modal__subtitle">
              {affiliate.nombreCompleto} · Nº {affiliate.numeroAfiliado}
              {affiliate.plan && ` · Plan: ${affiliate.plan}`}
            </p>
          </div>
          <button type="button" className="affiliate-history-modal__close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="affiliate-history-modal__body">
          {appointments.length === 0 ? (
            <p className="affiliate-history-modal__empty">Este afiliado aún no tiene turnos cargados.</p>
          ) : (
            <table className="affiliate-history-modal__table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Tipo</th>
                  <th>Especialidad / Laboratorio</th>
                  <th>Plan</th>
                  <th>Prestador</th>
                  <th>Profesional</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(getTurnoDate(a))}</td>
                    <td>{a.time}</td>
                    <td>{a.tipoAtencion === 'laboratorio' ? 'Laboratorio' : 'Especialidad'}</td>
                    <td>{a.tipoAtencion === 'laboratorio' ? a.laboratorio : a.especialidad}</td>
                    <td>{a.plan}</td>
                    <td>{a.prestador}</td>
                    <td>{a.profesional}</td>
                    <td>{a.monto > 0 ? `$ ${a.monto.toFixed(2)}` : ''}</td>
                    <td>
                      {a.estado === 'pendiente' && 'Pendiente'}
                      {a.estado === 'tomado' && 'Tomado'}
                      {a.estado === 'recepcionado' && 'Recepcionado'}
                      {a.estado === 'cancelado' && 'Cancelado'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <footer className="affiliate-history-modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}

interface TurnoModalProps {
  mode: 'tomar' | 'recepcionar'
  affiliate: Affiliate
  defaultDate: string
  initialTime?: string | null
  appointment?: Appointment
  onClose: () => void
  onSave: (payload: {
    id?: string
    affiliateId: string
    date: string
    controlDate?: string
    time: string
    tipoAtencion: 'especialidad' | 'laboratorio'
    especialidad?: string
    laboratorio?: string
    plan: string
    prestador: string
    monto: number
    profesional: string
    estado: AppointmentStatus
  }) => Promise<void> | void
  isSlotTaken: (date: string, time: string) => boolean

  laboratorioOptions: string[]
  especialidadesOptions: string[]
  getLaboratorioPrice: (nombre: string, planRaw: string) => number
  getEspecialidadPrice: (nombre: string, planRaw: string) => number
  pricesLoading: boolean
  pricesError: string | null
}

const TurnoModal: React.FC<TurnoModalProps> = ({
  mode,
  affiliate,
  defaultDate,
  initialTime,
  appointment,
  onClose,
  onSave,
  isSlotTaken,

  laboratorioOptions,
  especialidadesOptions,
  getLaboratorioPrice,
  getEspecialidadPrice,
  pricesLoading,
  pricesError,
}) => {
  const canRecepcionar = Boolean(appointment)

  const [activeTab, setActiveTab] = useState<'tomar' | 'recepcionar'>(
    mode === 'recepcionar' && canRecepcionar ? 'recepcionar' : 'tomar',
  )

  const [date, setDate] = useState(appointment?.date ?? defaultDate)
  const [controlDate, setControlDate] = useState(
    appointment?.controlDate ?? appointment?.date ?? defaultDate,
  )
  const [time, setTime] = useState(appointment?.time ?? initialTime ?? '10:00')

  const [tipoAtencion, setTipoAtencion] = useState<'especialidad' | 'laboratorio'>(
    appointment?.tipoAtencion ?? 'especialidad',
  )

  const [especialidad, setEspecialidad] = useState(appointment?.especialidad ?? '')
  const [laboratorio, setLaboratorio] = useState(appointment?.laboratorio ?? '')

  const [plan, setPlan] = useState(appointment?.plan ?? affiliate.plan ?? '')
  const [prestador, setPrestador] = useState(appointment?.prestador ?? PRESTADORES[0])
  const [profesional, setProfesional] = useState(appointment?.profesional ?? '')
  const [motivo, setMotivo] = useState('')

  const [montoInput, setMontoInput] = useState<string>(() => {
    if (typeof appointment?.monto === 'number') return String(appointment.monto)
    return '0'
  })
  const [isMontoManual, setIsMontoManual] = useState(false)

  const isReadOnlyRecep = activeTab === 'recepcionar'

  const dlEspId = useMemo(
    () => `dl-esp-${affiliate.id}-${appointment?.id ?? 'new'}`,
    [affiliate.id, appointment?.id],
  )
  const dlLabId = useMemo(
    () => `dl-lab-${affiliate.id}-${appointment?.id ?? 'new'}`,
    [affiliate.id, appointment?.id],
  )

  const especialidadesList = useMemo(() => {
    const arr = Array.isArray(especialidadesOptions) ? especialidadesOptions : []
    return Array.from(new Set(arr.map((s) => String(s).trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [especialidadesOptions])

  const laboratorioList = useMemo(() => {
    const arr = Array.isArray(laboratorioOptions) ? laboratorioOptions : []
    return Array.from(new Set(arr.map((s) => String(s).trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [laboratorioOptions])

  const calculateNewPrice = (
    currentPrestador: string,
    currentTipo: 'especialidad' | 'laboratorio',
    currentEsp: string,
    currentLab: string,
    currentPlan: string,
  ) => {
    if (currentPrestador === 'MEDIC') return 0
    if (currentTipo === 'especialidad' && currentEsp) {
      return getEspecialidadPrice(currentEsp, currentPlan)
    }
    if (currentTipo === 'laboratorio' && currentLab) {
      return getLaboratorioPrice(currentLab, currentPlan)
    }
    return 0
  }

  const updateMontoState = (newVal: number, forceUpdate = false) => {
    if (!isMontoManual || forceUpdate) setMontoInput(String(newVal))
  }

  const handlePrestadorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setPrestador(val)

    if (val !== 'MEDIC') setProfesional('')

    const newPrice = calculateNewPrice(val, tipoAtencion, especialidad, laboratorio, plan)

    if (val === 'MEDIC') {
      setMontoInput('0')
      setIsMontoManual(false)
    } else {
      updateMontoState(newPrice)
    }
  }

  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setPlan(val)

    const newPrice = calculateNewPrice(prestador, tipoAtencion, especialidad, laboratorio, val)
    updateMontoState(newPrice)
  }

  const handleTipoAtencionChange = (tipo: 'especialidad' | 'laboratorio') => {
    setTipoAtencion(tipo)

    if (tipo === 'especialidad') setLaboratorio('')
    else setEspecialidad('')

    const newPrice = calculateNewPrice(prestador, tipo, especialidad, laboratorio, plan)
    updateMontoState(newPrice)
  }

  const handleEspecialidadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setEspecialidad(val)

    if (tipoAtencion === 'especialidad') {
      const newPrice = calculateNewPrice(prestador, 'especialidad', val, laboratorio, plan)
      updateMontoState(newPrice)
    }
  }

  const handleLaboratorioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLaboratorio(val)

    if (tipoAtencion === 'laboratorio') {
      const newPrice = calculateNewPrice(prestador, 'laboratorio', especialidad, val, plan)
      updateMontoState(newPrice)
    }
  }

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(',', '.')
    setIsMontoManual(true)

    if (raw === '') {
      setMontoInput('')
      return
    }
    if (!/^\d*\.?\d*$/.test(raw)) return
    setMontoInput(raw)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !time) return

    const estado: AppointmentStatus = activeTab === 'tomar' ? 'tomado' : 'recepcionado'

    const parsed = Number(montoInput)
    const montoNumber = Number.isFinite(parsed) ? Math.max(0, parsed) : 0

    await onSave({
      id: appointment?.id,
      affiliateId: affiliate.id,
      date,
      controlDate: controlDate || undefined,
      time,
      tipoAtencion,
      especialidad: tipoAtencion === 'especialidad' ? especialidad || undefined : undefined,
      laboratorio: tipoAtencion === 'laboratorio' ? laboratorio || undefined : undefined,
      plan,
      prestador,
      monto: montoNumber,
      profesional,
      estado,
    })

    onClose()
  }

  const effectiveTurnoDate = controlDate || date
  const slotTaken = effectiveTurnoDate && time ? isSlotTaken(effectiveTurnoDate, time) : false

  const allPlanOptions = Array.from(
    new Set([plan, affiliate.plan, ...PLAN_OPTIONS].filter((p): p is string => Boolean(p))),
  )

  return (
    <div className="turno-modal-overlay">
      <div className="turno-modal">
        <header className="turno-modal__header">
          <div>
            <h2 className="turno-modal__title">
              {activeTab === 'tomar' ? 'Tomar turno' : 'Recepcionar turno'}
            </h2>
            <p className="turno-modal__subtitle">
              {affiliate.nombreCompleto} · Nº {affiliate.numeroAfiliado}
              {affiliate.plan && ` · Plan: ${affiliate.plan}`}
            </p>

            {(pricesLoading || pricesError) && (
              <p className="turno-modal__subtitle" style={{ marginTop: 6 }}>
                {pricesLoading
                  ? 'Cargando precios…'
                  : pricesError
                    ? `Precios: ${pricesError}`
                    : null}
              </p>
            )}
          </div>

          <button type="button" className="turno-modal__close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="turno-modal__tabs">
          <button
            type="button"
            className={`turno-modal__tab ${activeTab === 'tomar' ? 'turno-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('tomar')}
          >
            Tomar turno
          </button>
          <button
            type="button"
            className={`turno-modal__tab ${
              activeTab === 'recepcionar' ? 'turno-modal__tab--active' : ''
            } ${!canRecepcionar ? 'turno-modal__tab--disabled' : ''}`}
            onClick={() => {
              if (canRecepcionar) setActiveTab('recepcionar')
            }}
            disabled={!canRecepcionar}
          >
            Recepcionar
          </button>
        </div>

        <form className="turno-modal__body" onSubmit={handleSubmit}>
          <div className="turno-modal__grid">
            <label className="field">
              <span className="field__label">
                {activeTab === 'recepcionar' ? 'Fecha de recepción' : 'Fecha de hoy'}
              </span>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <label className="field">
              <span className="field__label">Fecha del turno (opcional)</span>
              <input
                type="date"
                className="input"
                value={controlDate}
                onChange={(e) => setControlDate(e.target.value)}
                disabled={activeTab === 'recepcionar'}
              />
            </label>

            <label className="field">
              <span className="field__label">Horario</span>
              <input
                type="time"
                className="input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={isReadOnlyRecep}
              />
              {slotTaken && !appointment && (
                <span className="field__hint field__hint--error">
                  Ese horario ya está ocupado para este día.
                </span>
              )}
            </label>

            <label className="field">
              <span className="field__label">Plan</span>
              <select className="input" value={plan} onChange={handlePlanChange} disabled={isReadOnlyRecep}>
                <option value="">Seleccionar plan…</option>
                {allPlanOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Prestador</span>
              <select className="input" value={prestador} onChange={handlePrestadorChange} disabled={isReadOnlyRecep}>
                {PRESTADORES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field--full">
              <span className="field__label">Se atiende por</span>
              <div className="field__segmented">
                <button
                  type="button"
                  className={`field__segmented-btn ${
                    tipoAtencion === 'especialidad' ? 'field__segmented-btn--active' : ''
                  }`}
                  onClick={() => handleTipoAtencionChange('especialidad')}
                  disabled={isReadOnlyRecep}
                >
                  Especialidad
                </button>
                <button
                  type="button"
                  className={`field__segmented-btn ${
                    tipoAtencion === 'laboratorio' ? 'field__segmented-btn--active' : ''
                  }`}
                  onClick={() => handleTipoAtencionChange('laboratorio')}
                  disabled={isReadOnlyRecep}
                >
                  Laboratorio
                </button>
              </div>
            </label>

            {tipoAtencion === 'especialidad' && (
              <label className="field field--full">
                <span className="field__label">Especialidad</span>
                <input
                  className="input"
                  list={dlEspId}
                  value={especialidad}
                  onChange={handleEspecialidadChange}
                  placeholder="Buscar especialidad…"
                  disabled={isReadOnlyRecep}
                />
                <datalist id={dlEspId}>
                  {especialidadesList.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </label>
            )}

            {tipoAtencion === 'laboratorio' && (
              <label className="field field--full">
                <span className="field__label">Laboratorio</span>
                <input
                  className="input"
                  list={dlLabId}
                  value={laboratorio}
                  onChange={handleLaboratorioChange}
                  placeholder="Buscar práctica de laboratorio…"
                  disabled={isReadOnlyRecep}
                />
                <datalist id={dlLabId}>
                  {laboratorioList.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </label>
            )}

            <label className="field field--full">
              <span className="field__label">Profesional</span>
              {prestador === 'MEDIC' ? (
                <select
                  className="input"
                  value={profesional}
                  onChange={(e) => setProfesional(e.target.value)}
                  disabled={isReadOnlyRecep}
                >
                  <option value="">Seleccionar profesional…</option>
                  {MEDIC_PROFESIONALES.map((doc) => (
                    <option key={doc} value={doc}>
                      {doc}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input" value={profesional} onChange={() => {}} placeholder="Solo MEDIC" disabled />
              )}
            </label>

            <label className="field">
              <span className="field__label">Monto (coseguro)</span>
              <input
                className="input"
                value={montoInput}
                onChange={handleMontoChange}
                placeholder="Se calcula según plan y práctica"
                inputMode="decimal"
              />
              {isMontoManual && (
                <span className="field__hint field__hint--error">
                  Modificar el valor en caso de ser necesario.
                </span>
              )}
            </label>

            {activeTab === 'recepcionar' && (
              <label className="field field--full">
                <span className="field__label">Motivo / Nota de recepción</span>
                <input
                  className="input"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo de la consulta, notas rápidas…"
                />
              </label>
            )}
          </div>

          <footer className="turno-modal__footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={slotTaken && !appointment}>
              {activeTab === 'tomar' ? 'Guardar turno' : 'Confirmar y recepcionar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}

export { Appointment, Affiliate }
