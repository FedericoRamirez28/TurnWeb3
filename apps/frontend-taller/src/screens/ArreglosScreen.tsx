// src/screens/ArreglosScreen.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

import KanbanBoard from '@/components/ui/KanbanBoard'
import type { Tablero, Arreglo } from '@/lib/tallerTypes'

import CalendarioMovil from '@/components/ui/CalendarioMovil'
import NotificationsCenter, { pushMobilNotification } from '@/components/ui/NotificationsCenter'

import { api } from '@/lib/api'
import { useMovilId } from '@/screens/useMovilId'

// ✅ Modal Nuevo
import ModalFormularioArreglo, { type NuevoArregloDto } from '@/components/modales/ModalFormularioArreglo'

// ✅ Modal Día Calendario (modo lectura)
import ModalCalendarioDia from '@/components/modales/ModalCalendarioDia'

/* ===== Constantes mantenimiento (km) ===== */
const KM_ACEITE = 10000
const KM_BUJIAS = 30000
const KM_AIRE = 15000
const KM_AC = 20000
const KM_COMBUSTIBLE = 40000
const KM_DISTRIBUCION = 150000

/* ===== Utils ===== */
const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const n = (x: any) => Number(x) || 0

const toISO = (d: Date) =>
  d instanceof Date && !isNaN(d as any)
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : ''

const parseISO = (s: string) => {
  const d = new Date((s || '') + 'T00:00:00')
  return isNaN(d as any) ? null : d
}

const addYears = (d: Date, k: number) => new Date(d.getFullYear() + k, d.getMonth(), d.getDate())

/* ===== Persistencia de umbrales por barra ===== */
const kSeen = (movilId: string | number, barKey: string) => `ts_notif_seen_${String(movilId)}_${barKey}`
const defaultSeen = { x50: false, x75: false, x100: false }

function getSeen(movilId: string | number, barKey: string) {
  try {
    const raw = localStorage.getItem(kSeen(movilId, barKey))
    return raw ? { ...defaultSeen, ...(JSON.parse(raw) || {}) } : { ...defaultSeen }
  } catch {
    return { ...defaultSeen }
  }
}
function setSeen(movilId: string | number, barKey: string, state: Partial<typeof defaultSeen>) {
  try {
    localStorage.setItem(kSeen(movilId, barKey), JSON.stringify({ ...defaultSeen, ...state }))
  } catch {
    // noop
  }
}
function resetSeen(movilId: string | number, barKey: string) {
  setSeen(movilId, barKey, defaultSeen)
}

type Props = {
  filtroExterno?: string
  sidebarAbierto?: boolean
  setSidebarAbierto?: (v: boolean) => void
}

type MovilInfo = { patente_fija?: string | null }

type ParteDiario = {
  id?: string | null
  chofer?: string | null

  // ✅ compat: pueden venir en snake o camel
  km_inicio?: number | string | null
  km_fin?: number | string | null
  kmInicio?: number | string | null
  kmFin?: number | string | null

  // ✅ NUEVO: lo que te falta mostrar
  patente?: string | null
  observaciones?: string | null

  createdAt?: string | null
  fecha?: string | null
  fechaISO?: string | null
}

type VtvGet = { fecha: string | null }
type VtvPut = { ok: true }

type Prioridad = 'baja' | 'alta' | 'urgente'

type DiaDetalle = {
  fecha: string
  prioridadMax: Prioridad
  arreglos: Array<{
    id: string
    patente: string | null
    fechaISO: string | null
    motivo: string | null
    anotaciones: string | null
    prioridad: Prioridad
    createdAt: string
    tareas: Array<{ id: string; texto: string; completa: boolean; orden: number }>
  }>
  partes: Array<{
    id: string
    fechaISO: string
    chofer: string | null
    km_inicio: number | null
    km_fin: number | null
    createdAt: string
  }>
}

export default function ArreglosScreen({
  filtroExterno = '',
  sidebarAbierto: sidebarProp,
  setSidebarAbierto: setSidebarProp,
}: Props) {
  const nav = useNavigate()

  const movilIdParam = useMovilId()
  const movilIdSafe: string | number = movilIdParam ?? ''

  // si entran sin móvil, lo mandamos a Home
  useEffect(() => {
    if (!movilIdParam) nav('/', { replace: true })
  }, [movilIdParam, nav])

  const filtroActivo = String(filtroExterno || '')

  const [modoEliminar, setModoEliminar] = useState(false)
  const [toastMensaje, setToastMensaje] = useState('')

  const [sidebarLocal, setSidebarLocal] = useState(false)
  const sidebarAbierto = typeof sidebarProp === 'boolean' ? sidebarProp : sidebarLocal
  const setSidebarAbierto = typeof setSidebarProp === 'function' ? setSidebarProp : setSidebarLocal
  void sidebarAbierto
  void setSidebarAbierto

  const [tablero, setTablero] = useState<Tablero>({ Inbox: [], 'In progress': [], Done: [] })

  const [chofer, setChofer] = useState('')
  const [patente, setPatente] = useState('')
  const [kmInicio, setKmInicio] = useState(0)
  const [kmFin, setKmFin] = useState(0)
  const [parte, setParte] = useState<ParteDiario | null>(null)

  const [patenteFija, setPatenteFija] = useState('')

  // ✅ NUEVO: último texto de observaciones (para mostrar abajo de mantenimiento)
  const [obsUltimo, setObsUltimo] = useState('')
  const [obsUltimoAt, setObsUltimoAt] = useState('')

  // ✅ Refresca el calendario (dots)
  const [calRefresh, setCalRefresh] = useState(0)

  // ✅ Modal Nuevo desde navbar
  const [nuevoOpen, setNuevoOpen] = useState(false)

  // ✅ Modal Día Calendario (modo lectura)
  const [diaModalOpen, setDiaModalOpen] = useState(false)
  const [diaDetalle, setDiaDetalle] = useState<DiaDetalle | null>(null)

  // permitir que otros componentes pidan refrescar el calendario
  useEffect(() => {
    const onCal = () => setCalRefresh((v) => v + 1)
    window.addEventListener('ts:calendar:refresh', onCal)
    return () => window.removeEventListener('ts:calendar:refresh', onCal)
  }, [])

  // ✅ CLAVE: cuando ParteDiariaScreen guarda, recargamos patente + observaciones acá
  useEffect(() => {
    const onParteUpdated = () => {
      cargarParteDiario()
      setCalRefresh((v) => v + 1) // opcional: actualiza dots del calendario
    }
    window.addEventListener('ts:parte-diario:updated', onParteUpdated)
    return () => window.removeEventListener('ts:parte-diario:updated', onParteUpdated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== acumulado por partes (persistente) =====
  const acumKey = movilIdParam ? `ts_km_acum_${String(movilIdParam)}` : null
  const lastSigKey = movilIdParam ? `ts_km_last_sig_${String(movilIdParam)}` : null
  const [kmAcum, setKmAcum] = useState(0)

  // ===== base por service (UNA por barra) =====
  const baseKey = (k: string) => (movilIdParam ? `ts_km_base_${String(movilIdParam)}_${k}` : null)
  const getBase = (k: string) => n(localStorage.getItem(baseKey(k) || ''))
  const setBase = (k: string, v: number) => localStorage.setItem(baseKey(k) || '', String(n(v)))

  // ===== VTV (persistente en backend) =====
  const [vtvFecha, setVtvFecha] = useState('')
  const [vtvModalAbierto, setVtvModalAbierto] = useState(false)

  const vtvParsed = parseISO(vtvFecha)
  const vtvProximoVenc = vtvParsed ? addYears(vtvParsed, 1) : null
  const hoy = new Date()
  const MS_DIA = 24 * 60 * 60 * 1000
  const diasRestantes = vtvProximoVenc ? Math.ceil((vtvProximoVenc.getTime() - hoy.getTime()) / MS_DIA) : null
  const vtvVencida = diasRestantes != null && diasRestantes < 0
  const vtvProgreso =
    vtvParsed && vtvProximoVenc
      ? clamp01((hoy.getTime() - vtvParsed.getTime()) / (vtvProximoVenc.getTime() - vtvParsed.getTime()))
      : 0

  /* ===== fetchers ===== */
  async function cargarInfoMovil() {
    if (!movilIdParam) return
    const j = await api.get<MovilInfo>(`/moviles/${encodeURIComponent(String(movilIdParam))}/info`)
    if (j.ok) setPatenteFija(j.data?.patente_fija ?? '')
    else console.warn('infoMovil:', j.error)
  }

  async function cargarParteDiario() {
    if (!movilIdParam) return

    const j = await api.get<ParteDiario | null>(`/moviles/${encodeURIComponent(String(movilIdParam))}/parte-diario/ultimo`)

    if (!j.ok) {
      console.warn('parteDiario:', j.error)
      setParte(null)
      setChofer('')
      setKmInicio(0)
      setKmFin(0)
      setObsUltimo('')
      setObsUltimoAt('')
      return
    }

    setParte(j.data ?? null)

    const p = j.data

    // ✅ Chofer
    setChofer(p?.chofer ?? '')

    // ✅ Km (compat snake/camel)
    const kIni = n(p?.km_inicio ?? p?.kmInicio)
    const kFin = n(p?.km_fin ?? p?.kmFin)
    setKmInicio(kIni)
    setKmFin(kFin)

    // ✅ Patente: prioridad parte -> patente fija
    const pat = String(p?.patente || '').trim()
    if (pat) setPatente(pat.toUpperCase())
    else if (patenteFija) setPatente((patenteFija || '').toUpperCase())

    // ✅ Observaciones
    const obs = String(p?.observaciones || '').trim()
    setObsUltimo(obs)
    setObsUltimoAt(String(p?.createdAt || p?.fechaISO || p?.fecha || '').trim())

    // acumulado persistente
    const lastSig = lastSigKey ? n(localStorage.getItem(lastSigKey)) : 0
    const delta = Math.max(0, kFin - kIni)
    const sig = kFin

    if (acumKey) {
      const prev = n(localStorage.getItem(acumKey))
      if (!lastSig || sig !== lastSig) {
        localStorage.setItem(acumKey, String(prev + delta))
        if (lastSigKey) localStorage.setItem(lastSigKey, String(sig))
      }
      setKmAcum(n(localStorage.getItem(acumKey)))
    }
  }

  async function cargarVTV() {
    if (!movilIdParam) return
    const j = await api.get<VtvGet>(`/moviles/${encodeURIComponent(String(movilIdParam))}/vtv`)
    if (j.ok) setVtvFecha(j.data?.fecha || '')
    else {
      console.warn('VTV get:', j.error)
      setVtvFecha('')
    }
  }

  async function guardarVTV(fechaISO: string) {
    if (!movilIdParam) return
    const j = await api.put<VtvPut>(`/moviles/${encodeURIComponent(String(movilIdParam))}/vtv`, {
      fecha: fechaISO || null,
    })

    if (!j.ok) {
      console.error('VTV put:', j.error)
      alert('No se pudo guardar la VTV')
      return
    }

    setVtvFecha(fechaISO || '')
    setToastMensaje(fechaISO ? '✅ VTV guardada' : '✅ VTV borrada')
    setTimeout(() => setToastMensaje(''), 1500)
  }

  async function cargarArreglos() {
    if (!movilIdParam) return
    const j = await api.get<Arreglo[]>(`/arreglos?movilId=${encodeURIComponent(String(movilIdParam))}`)
    if (!j.ok) {
      console.error(j.error)
      return
    }

    const arr = Array.isArray(j.data) ? j.data : []
    const nuevo: Tablero = { Inbox: [], 'In progress': [], Done: [] }

    arr.forEach((a) => {
      const tareas = Array.isArray((a as any).tareas) ? (a as any).tareas : []
      const todas = tareas.length > 0 && tareas.every((t: { completa?: boolean }) => !!t?.completa)
      const alguna = tareas.some((t: { completa?: boolean }) => !!t?.completa)

      if (todas) nuevo.Done.push(a)
      else if (alguna) nuevo['In progress'].push(a)
      else nuevo.Inbox.push(a)
    })

    setTablero(nuevo)
  }

  async function abrirDiaCalendario(fechaISO: string) {
    if (!movilIdParam) return

    const r = await api.get<DiaDetalle>(
      `/moviles/${encodeURIComponent(String(movilIdParam))}/calendario/dia?fecha=${encodeURIComponent(fechaISO)}`,
    )

    if (!r.ok) {
      Swal.fire({ icon: 'error', title: 'Calendario', text: r.error || 'No se pudo cargar el día' })
      return
    }

    setDiaDetalle(r.data)
    setDiaModalOpen(true)
  }

  // Carga inicial
  useEffect(() => {
    if (!movilIdParam) return
    cargarInfoMovil()
    cargarParteDiario()
    cargarArreglos()
    cargarVTV()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movilIdParam])

  // si no vino patente por parte, usamos patente fija cuando llegue
  useEffect(() => {
    if (!patente && patenteFija) setPatente((patenteFija || '').toUpperCase())
  }, [patente, patenteFija])

  // ===== mantenimiento por barras (con base propia) =====
  const kmFinalParte = n(kmFin)
  const BARRAS = useMemo(
    () => [
      { key: 'aceite', label: 'Cambio de aceite y filtros', km: KM_ACEITE },
      { key: 'bujias', label: 'Cambio de bujías', km: KM_BUJIAS },
      { key: 'aire', label: 'Cambio de aire', km: KM_AIRE },
      { key: 'ac', label: 'Cambio de a/c', km: KM_AC },
      { key: 'combustible', label: 'Cambio de combustible', km: KM_COMBUSTIBLE },
      { key: 'distribucion', label: 'Cambio de Distribución', km: KM_DISTRIBUCION },
    ],
    [],
  )

  // inicializa base/flags si no existen
  useEffect(() => {
    if (!movilIdParam || !kmFinalParte) return
    BARRAS.forEach(({ key }) => {
      const k = baseKey(key)
      if (k && localStorage.getItem(k) == null) setBase(key, kmFinalParte)
      if (localStorage.getItem(kSeen(movilIdParam, key)) == null) resetSeen(movilIdParam, key)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movilIdParam, kmFinalParte, BARRAS])

  const cicloDe = (key: string) => Math.max(0, kmFinalParte - getBase(key))
  const pctDe = (key: string, intervalo: number) => clamp01(cicloDe(key) / intervalo)
  const isOver = (key: string, intervalo: number) => cicloDe(key) >= intervalo

  /* ===================== ALERTAS (50/75/100) ===================== */
  useEffect(() => {
    if (!Number.isFinite(kmFinalParte) || kmFinalParte <= 0) return
    if (!movilIdParam) return

    const queue: {
      key: string
      label: string
      km: number
      level: 'x50' | 'x75' | 'x100'
      pct: number
      over: boolean
    }[] = []

    BARRAS.forEach(({ key, label, km }) => {
      const pct = pctDe(key, km)
      const over = isOver(key, km)
      const seen = getSeen(movilIdParam, key)

      const level: 'x50' | 'x75' | 'x100' | null =
        over ? 'x100' : pct >= 0.75 ? 'x75' : pct >= 0.5 ? 'x50' : null

      if (!level) {
        if (pct < 0.1) resetSeen(movilIdParam, key)
        return
      }
      if (seen[level]) return

      setSeen(movilIdParam, key, { ...seen, [level]: true })
      queue.push({ key, label, km, level, pct, over })
    })

    if (!queue.length) return

    queue.sort(
      (a, b) =>
        (a.level === 'x100' ? -1 : a.level === 'x75' ? -0.5 : 0) -
        (b.level === 'x100' ? -1 : b.level === 'x75' ? -0.5 : 0),
    )

    const first = queue[0]
    const pctTxt = first.over ? '100%' : `${Math.round(first.pct * 100)}%`
    const icon = first.level === 'x100' ? 'error' : first.level === 'x75' ? 'warning' : 'info'

    Swal.fire({
      icon,
      title: `Mantenimiento ${pctTxt}`,
      html: `<div style="text-align:left">
        <b>${first.label}</b><br/>
        Móvil: <b>${movilIdParam}</b><br/>
        Ciclo: <b>${cicloDe(first.key)}</b> / ${first.km} km
      </div>`,
      confirmButtonText: 'OK',
    })

    try {
      pushMobilNotification(movilIdParam, {
        level: first.level === 'x100' ? 'danger' : first.level === 'x75' ? 'warn' : 'info',
        title: `Mantenimiento ${pctTxt}`,
        message: `${first.label} · ciclo ${cicloDe(first.key)} / ${first.km} km`,
        meta: { key: first.key, threshold: first.level },
      })
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kmFinalParte, movilIdParam])

  // ===== helpers =====
  const reiniciarAcumulado = () => {
    if (!acumKey) return
    localStorage.setItem(acumKey, '0')
    if (lastSigKey) localStorage.setItem(lastSigKey, '0')
    setKmAcum(0)
    setToastMensaje('🔁 Contador reiniciado')
    setTimeout(() => setToastMensaje(''), 1200)
  }

  // ===== CRUD arreglos =====
  const handleNuevoArreglo = async (dto: NuevoArregloDto) => {
    if (!movilIdParam) return

    const payload: any = {
      ...dto,
      movilId: String(movilIdParam),
      patente: dto.patente ?? patente ?? patenteFija ?? null,
      fechaISO: (dto as any).fechaISO ?? (dto as any).fecha ?? null,
    }

    const r = await api.post<Arreglo>('/arreglos', payload)

    if (!r.ok) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo crear el arreglo',
        text: r.error || 'Error desconocido',
      })
      return
    }

    const creado = r.data

    setTablero((prev) => {
      const tareas = Array.isArray((creado as any).tareas) ? (creado as any).tareas : []
      const todas = tareas.length > 0 && tareas.every((t: { completa?: boolean }) => !!t?.completa)
      const alguna = tareas.some((t: { completa?: boolean }) => !!t?.completa)

      const col = (todas ? 'Done' : alguna ? 'In progress' : 'Inbox') as keyof Tablero
      return { ...prev, [col]: [creado, ...(prev[col] || [])] }
    })

    setNuevoOpen(false)
    setToastMensaje('✅ Arreglo creado')
    setTimeout(() => setToastMensaje(''), 1500)

    window.dispatchEvent(new Event('ts:calendar:refresh'))
    window.dispatchEvent(new Event('ts:historial-dia:refetch'))
    window.dispatchEvent(new Event('ts:home:refresh'))
  }

  // ===== Finalizar arreglos =====
  const finalizarArreglos = async () => {
    const arreglosAfinalizar = [...tablero.Done]
    if (!arreglosAfinalizar.length) {
      setToastMensaje('ℹ️ No hay arreglos en Done')
      setTimeout(() => setToastMensaje(''), 1200)
      return
    }
    if (!movilIdParam) return

    try {
      const ok = await Swal.fire({
        icon: 'question',
        title: 'Finalizar arreglos',
        text: `Se moverán ${arreglosAfinalizar.length} arreglo(s) a Finalizados. ¿Continuar?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, finalizar',
        cancelButtonText: 'Cancelar',
      })
      if (!ok.isConfirmed) return

      const r = await api.post<any>(`/finalizados`, { arreglos: arreglosAfinalizar, movilId: movilIdParam })
      if (!r.ok) throw new Error(r.error || 'No se pudo finalizar')

      setTablero((p) => ({ ...p, Done: [] }))

      setToastMensaje('✅ Arreglos finalizados correctamente.')
      setTimeout(() => setToastMensaje(''), 2000)

      setCalRefresh((v) => v + 1)
      window.dispatchEvent(new Event('ts:calendar:refresh'))
      window.dispatchEvent(new Event('ts:historial-dia:refetch'))
      window.dispatchEvent(new Event('ts:home:refresh'))

      nav(`/movil/${movilIdParam}/finalizados`)
    } catch (e) {
      console.error(e)
      alert('No se pudo finalizar.')
    }
  }

  // ✅ Integración con TopNavbar (eventos)
  useEffect(() => {
    const onNuevo = () => setNuevoOpen(true)

    const onToggleEliminar = () => {
      setModoEliminar((v) => !v)
      setToastMensaje((prev) => (prev ? '' : '🗑️ Modo eliminar alternado'))
      setTimeout(() => setToastMensaje(''), 1000)
    }

    const onEditarUltimo = () => {
      const last = (window as any).__ts_last_arreglo as Arreglo | undefined
      if (!last?.id) {
        Swal.fire({
          icon: 'info',
          title: 'Editar arreglo',
          text: 'Primero abrí (doble click) o tocá ✏️ en una tarjeta para seleccionarla.',
          confirmButtonText: 'OK',
        })
        return
      }
      window.dispatchEvent(new CustomEvent('ts:kanban:open-detalle', { detail: { arregloId: last.id } }))
    }

    const onFinalizar = () => finalizarArreglos()

    window.addEventListener('ts:arreglos:nuevo', onNuevo)
    window.addEventListener('ts:arreglos:toggle-eliminar', onToggleEliminar)
    window.addEventListener('ts:arreglos:editar-ultimo', onEditarUltimo)
    window.addEventListener('ts:arreglos:finalizar', onFinalizar)

    return () => {
      window.removeEventListener('ts:arreglos:nuevo', onNuevo)
      window.removeEventListener('ts:arreglos:toggle-eliminar', onToggleEliminar)
      window.removeEventListener('ts:arreglos:editar-ultimo', onEditarUltimo)
      window.removeEventListener('ts:arreglos:finalizar', onFinalizar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablero.Done.length, movilIdParam])

  const vtvHeader = (
    <div className="vtv-body">
      <div className="vtv-line">
        Última VTV: <strong>{vtvFecha}</strong>
      </div>
      <div className="vtv-line">
        Próx. vencimiento: <strong>{vtvParsed ? toISO(addYears(vtvParsed, 1)) : '-'}</strong>
      </div>
      <div className="vtv-line">
        Días restantes: <strong className={vtvVencida ? 'danger' : ''}>{diasRestantes != null ? diasRestantes : '-'}</strong>
      </div>
      <progress className={`vtv-progress ${vtvVencida ? 'vtv-progress--danger' : ''}`} max={1} value={vtvProgreso} />
    </div>
  )

  if (!movilIdParam) return <div style={{ padding: 16 }}>Cargando…</div>

  return (
    <>
      <div className="arreglos-page">
        <div className="arreglos-layout">
          <section className="col-izquierda">
            {/* Datos del móvil */}
            <div className="datos-movil">
              <div>
                <label>Móvil:</label>
                <input type="text" value={String(movilIdSafe)} disabled />
              </div>
              <div>
                <label>Patente:</label>
                <input type="text" value={patente} disabled />
              </div>
              <div>
                <label>Chofer:</label>
                <input type="text" value={chofer} disabled />
              </div>
            </div>

            {/* KM acumulados */}
            <div className="km-card">
              <div className="km-title">Kilómetros acumulados</div>
              <div className="km-value">{kmAcum} km</div>
              <div className="km-meta">
                Último parte: Km inicio <strong>{kmInicio}</strong> · Km final <strong>{kmFin}</strong> · Delta{' '}
                <strong>{Math.max(0, kmFin - kmInicio)}</strong>
              </div>

              <div className="km-actions">
                <button className="btn-soft" onClick={() => cargarParteDiario()} type="button">
                  ↻ Actualizar
                </button>
                <button className="btn-soft" onClick={reiniciarAcumulado} type="button">
                  🔁 Reiniciar contador
                </button>
              </div>
            </div>

            {/* VTV */}
            <div className="vtv-summary">
              <div className={`vtv-card ${vtvVencida ? 'vencida' : ''}`}>
                <div className="vtv-header">
                  <div className="vtv-title">VTV</div>
                  <button className="btn-soft" onClick={() => setVtvModalAbierto(true)} type="button">
                    📅 Cargar última VTV
                  </button>
                </div>
                {vtvFecha ? vtvHeader : <div className="vtv-empty">Sin fecha cargada. Cargá la última VTV.</div>}
              </div>
            </div>

            {/* Calendario */}
            <div className="calendar-card">
              <h3 className="titulo-bloque">Calendario del móvil</h3>
              <div className="calendar-inner">
                <CalendarioMovil
                  movilId={movilIdSafe}
                  refreshToken={calRefresh}
                  onSelectDate={(iso, dayEvents) => {
                    if (!dayEvents?.length) return
                    abrirDiaCalendario(iso)
                  }}
                />
              </div>
            </div>
          </section>

          <section className="col-derecha">
            <div className="top-row">
              <h1 className="titulo-bloque">Gestión de Tareas</h1>
              <NotificationsCenter movilId={movilIdSafe} />
            </div>

            <div className="kanban-card">
              <KanbanBoard
                movilId={movilIdSafe}
                tablero={tablero}
                setTablero={setTablero}
                filtro={filtroActivo}
                modoEliminar={modoEliminar}
                salirModoEliminar={() => setModoEliminar(false)}
              />
            </div>

            {/* Barras por service */}
            <div className="mant-card">
              <div className="mant-card__head">
                <div className="mant-card__title">Mantenimiento</div>
                <div className="mant-card__hint">Contadores por service</div>
              </div>

              <div className="mant-scroll">
                {BARRAS.map(({ key, label, km }) => {
                  const ciclo = Math.max(0, Math.max(0, kmFinalParte - getBase(key)))
                  const pct = clamp01(ciclo / km)
                  const over = ciclo >= km
                  const excedente = Math.max(0, ciclo - km)
                  const falta = Math.max(0, km - ciclo)

                  return (
                    <div key={key} className="mant-row">
                      <div className="mant-head">
                        <label>{label}</label>
                        <div className="head-right">
                          {over && <span className="pill-needed">Cambio necesario</span>}
                          <button
                            className="btn-mini"
                            type="button"
                            onClick={() => {
                              setBase(key, kmFinalParte)
                              resetSeen(movilIdParam, key)
                              setToastMensaje('✅ Ciclo reiniciado')
                              setTimeout(() => setToastMensaje(''), 1200)
                            }}
                          >
                            Marcar realizado
                          </button>
                        </div>
                      </div>

                      <div className="mant-meta">
                        ciclo: <strong>{ciclo}</strong> / {km} km {over ? `— excedente: ${excedente} km` : `— faltan ${falta} km`}
                      </div>

                      <progress
                        max={1}
                        value={over ? 1 : pct}
                        className={over ? 'progress--over' : pct >= 0.75 ? 'progress--75' : pct >= 0.5 ? 'progress--50' : ''}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ✅ Observaciones del chofer */}
            <div className="obs-card">
              <div className="obs-head">
                <div className="obs-title">Observaciones</div>
                <button className="btn-mini" type="button" onClick={() => cargarParteDiario()} title="Actualizar parte diario">
                  ↻ Actualizar
                </button>
              </div>

              <div className="obs-meta">
                <span>
                  Último parte: <strong>{chofer || '-'}</strong>
                </span>
                {obsUltimoAt ? <span className="obs-date">{obsUltimoAt}</span> : null}
              </div>

              <div className={`obs-body ${obsUltimo ? '' : 'empty'}`}>
                {obsUltimo ? obsUltimo : 'Sin observaciones cargadas en el último parte.'}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal VTV */}
      {vtvModalAbierto && (
        <div
          className="modal-overlay"
          onClick={(e) => (e.target as HTMLElement).classList.contains('modal-overlay') && setVtvModalAbierto(false)}
        >
          <div className="modal">
            <h3 style={{ marginTop: 0 }}>Cargar última VTV</h3>

            <label className="modal-label">Fecha última VTV</label>
            <input className="modal-input" type="date" value={vtvFecha} onChange={(e) => setVtvFecha(e.currentTarget.value)} />

            <div className="modal-actions">
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  guardarVTV(vtvFecha)
                  setVtvModalAbierto(false)
                }}
              >
                Guardar
              </button>

              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  guardarVTV('')
                  setVtvModalAbierto(false)
                }}
              >
                Borrar
              </button>

              <button className="btn ghost" type="button" onClick={() => setVtvModalAbierto(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal Nuevo Arreglo */}
      {nuevoOpen && (
        <ModalFormularioArreglo
          movilId={movilIdSafe}
          defaultPatente={patente || patenteFija}
          onClose={() => setNuevoOpen(false)}
          onAgregar={handleNuevoArreglo}
        />
      )}

      {/* ✅ Modal Día Calendario */}
      <ModalCalendarioDia
        open={diaModalOpen}
        data={diaDetalle}
        onClose={() => {
          setDiaModalOpen(false)
          setDiaDetalle(null)
        }}
      />

      {toastMensaje && <div className="toast">{toastMensaje}</div>}
    </>
  )
}
