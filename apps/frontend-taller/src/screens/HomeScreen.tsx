// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApiResult, Movil } from '@/lib/types'


import ambulanceImg from '../../assets/images/ambulance.png'
import BarraOpciones from '@/components/ui/BarraOpciones'
import { api } from '@/lib/api'

const AMBULANCIAS = [
  { id: 10, tamano: 'Chico', modelo: 'Renault Kangoo' },
  { id: 12, tamano: 'Chico', modelo: 'Renault Kangoo' },
  { id: 13, tamano: 'Chico', modelo: 'Renault Kangoo' },
  { id: 15, tamano: 'Chico', modelo: 'Renault Kangoo' },
  { id: 19, tamano: 'Chico', modelo: 'Renault Kangoo' },
  { id: 20, tamano: 'Medio', modelo: 'Renault Master' },
  { id: 22, tamano: 'Medio', modelo: 'Renault Master' },
  { id: 23, tamano: 'Medio', modelo: 'Renault Master' },
  { id: 24, tamano: 'Medio', modelo: 'Ford Transit' },
  { id: 25, tamano: 'Medio', modelo: 'Peugeot Boxer' },
  { id: 28, tamano: 'Medio', modelo: 'Peugeot Boxer' },
  { id: 31, tamano: 'Medio', modelo: 'Peugeot Boxer' },
  { id: 33, tamano: 'Medio', modelo: 'Peugeot Boxer' },
  { id: 35, tamano: 'Medio', modelo: 'Renault Master' },
  { id: 38, tamano: 'Medio', modelo: 'Renault Master' },
  { id: 42, tamano: 'Grande', modelo: 'Ford Transit' },
  { id: 44, tamano: 'Grande', modelo: 'Ford Transit' },
  { id: 45, tamano: 'Grande', modelo: 'Ford Transit' },
  { id: 46, tamano: 'Grande', modelo: 'Ford Transit' },
  { id: 47, tamano: 'Grande', modelo: 'Ford Transit' },
  { id: 50, tamano: 'Grande', modelo: 'Ford Transit' },
] as const

const ML_URL = 'https://listado.mercadolibre.com.ar/repuestos-autos-camionetas/'

type StripeStatus = 'alert' | 'warn' | 'ok'

type Prioridad = 'baja' | 'alta' | 'urgente'
type Filtro = 'todos' | Prioridad

type PrioridadesMap = Record<string, Prioridad>
type PatentesMap = Record<string, string>

type PdUrlResponse = ApiResult<{ key: string }>

function buildParteDiariaUrl({ movil, key }: { movil?: number; key?: string }) {
  const base =
    ((window as any).env && (window as any).env.PD_BASE) ||
    (import.meta as any).env?.VITE_PD_BASE ||
    window.location.origin

  const path = '/#/parte-diaria'
  const qs = new URLSearchParams()
  if (movil) qs.set('movil', String(movil))
  if (key) qs.set('key', String(key))
  return `${base}${path}?${qs.toString()}`
}

function openCalculator() {
  window.open('https://www.google.com/search?q=calculadora', '_blank', 'noopener,noreferrer')
}

function StatusStripe({ status }: { status?: StripeStatus | null }) {
  if (!status) return null
  return <span className={`stripe ${status}`} />
}

function AmbulanceCard({
  id,
  status,
  tamano,
  modelo,
}: {
  id: number
  status?: StripeStatus | null
  tamano: string
  modelo: string
}) {
  const nav = useNavigate()
  const go = () => nav(`/movil/${encodeURIComponent(String(id))}`)

  return (
    <button
      className="card has-ambulance"
      style={{ ['--card-img' as any]: `url(${ambulanceImg})` }}
      onClick={go}
      aria-label={`Abrir ambulancia ${id}`}
      type="button"
    >
      <StatusStripe status={status ?? null} />
      <div className="num-badge">{id}</div>
      <div className="meta">
        <div className="meta-line meta-tamano">{tamano}</div>
        <div className="meta-line meta-modelo">{modelo}</div>
      </div>
    </button>
  )
}

export default function HomeScreen({
  sidebarAbierto: sbProp,
  setSidebarAbierto: setSbProp,
}: {
  sidebarAbierto?: boolean
  setSidebarAbierto?: (v: boolean) => void
}) {
  const nav = useNavigate()

  const [sbLocal, setSbLocal] = useState(false)
  const sidebarAbierto = typeof sbProp === 'boolean' ? sbProp : sbLocal
  const setSidebarAbierto = typeof setSbProp === 'function' ? setSbProp : setSbLocal

  const [prioMap, setPrioMap] = useState<PrioridadesMap>({})
  const [patentesMap, setPatentesMap] = useState<PatentesMap>({})
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [q, setQ] = useState('')

  const [pdUrl, setPdUrl] = useState('')
  const [pdQr, setPdQr] = useState('')
  const [showPdModal, setShowPdModal] = useState(false)
  const [pdMovil, setPdMovil] = useState('')
  const [pdRegen, setPdRegen] = useState(false)
  const [pdLoading, setPdLoading] = useState(false)

  // === Fetch prioridades (mock/legacy endpoint) ===
  useEffect(() => {
    let abort = false
    ;(async () => {
      try {
        const j = await api.get<ApiResult<PrioridadesMap>>('/prioridades')
        if (!abort && j.ok) setPrioMap(j.data || {})
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      abort = true
    }
  }, [])

  // === Fetch info móviles (patentes) ===
  useEffect(() => {
    let abort = false
    ;(async () => {
      try {
        const j = await api.get<ApiResult<PatentesMap>>('/moviles-info')
        if (!abort && j.ok) setPatentesMap(j.data || {})
      } catch (e) {
        console.error(e)
      }
    })()
    return () => {
      abort = true
    }
  }, [])

  const stripeByMovil = useMemo(() => {
    const map: Record<string, StripeStatus | null> = {}
    for (const id of Object.keys(prioMap)) {
      const pr = prioMap[id]
      map[id] = pr === 'urgente' ? 'alert' : pr === 'alta' ? 'warn' : pr === 'baja' ? 'ok' : null
    }
    return map
  }, [prioMap])

  const ambFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase()

    return AMBULANCIAS.filter((a) => {
      const idStr = String(a.id)
      const pr = prioMap[idStr]

      if (filtro !== 'todos' && pr !== filtro) return false
      if (!term) return true

      const pat = (patentesMap[idStr] || '').toLowerCase()

      return (
        idStr.includes(term) ||
        (pat && pat.includes(term)) ||
        a.tamano.toLowerCase().includes(term) ||
        a.modelo.toLowerCase().includes(term)
      )
    })
  }, [filtro, q, prioMap, patentesMap])

  const cards = useMemo(
    () =>
      ambFiltradas.map((a) => (
        <AmbulanceCard
          key={a.id}
          id={a.id}
          tamano={a.tamano}
          modelo={a.modelo}
          status={stripeByMovil[String(a.id)] || null}
        />
      )),
    [ambFiltradas, stripeByMovil],
  )

  const Btn = ({ value, children }: { value: Filtro; children: React.ReactNode }) => (
    <button
      type="button"
      className={`pill-toggle ${filtro === value ? 'active' : ''}`}
      onClick={() => setFiltro(value)}
    >
      {children}
    </button>
  )

  const openML = () => window.open(ML_URL, '_blank', 'noopener,noreferrer')
  const scanner = () => alert('🔧 Escáner: funcionalidad próximamente.')
  const verFin = () => nav('/finalizados')
  const verHist = () => nav('/historial-patentes')

  function abrirModalPD() {
    setPdMovil('')
    setPdRegen(false)
    setPdUrl('')
    setPdQr('')
    setShowPdModal(true)
  }

  async function confirmarPD() {
    const movilNum = Number(String(pdMovil).trim())
    if (!movilNum) {
      alert('Ingresá un número de móvil válido.')
      return
    }

    try {
      setPdLoading(true)

      const j = await api.post<PdUrlResponse>(
        `/moviles/${encodeURIComponent(String(movilNum))}/pd-url`,
        { regen: !!pdRegen },
      )

      if (!j.ok) throw new Error(j.error || 'No se pudo generar la URL')

      const url = buildParteDiariaUrl({ movil: movilNum, key: j.data.key })
      setPdUrl(url)

      const encoded = encodeURIComponent(url)
      const qr = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`
      setPdQr(qr)

      try {
        await navigator.clipboard?.writeText(url)
      } catch {
        // noop
      }
    } catch (e) {
      console.error(e)
      alert('Error generando URL')
    } finally {
      setPdLoading(false)
    }
  }

  return (
    <div className="ts-home">
      <BarraOpciones
        abierto={sidebarAbierto}
        onOpen={() => setSidebarAbierto(true)}
        onClose={() => setSidebarAbierto(false)}
        mostrarAgregar={false}
        mostrarQuitar={false}
        mostrarSalirQuitar={false}
        mostrarFinalizar={false}
        mostrarVerFinalizados
        mostrarHistorial
        mostrarFinalizados={verFin}
        verHistorialPorPatente={verHist}
        mostrarHamburguesa={false}
        // props requeridas pero no usadas
        onNuevoArreglo={async () => {}}
        activarModoEliminar={() => {}}
        salirModoEliminar={() => {}}
        modoEliminar={false}
        onFinalizarArreglos={() => {}}
        verHistorialDelDia={() => {}}
      />

      <div className="top-actions">
        <div className="segmented">
          <Btn value="todos">Todos</Btn>
          <Btn value="baja">🟢 Baja</Btn>
          <Btn value="alta">🟡 Alta</Btn>
          <Btn value="urgente">🔴 Urgente</Btn>
        </div>

        <div className="actions-right">
          <button type="button" className="pill" onClick={openCalculator}>
            Calculadora
          </button>
          <button type="button" className="pill" onClick={scanner}>
            Escáner
          </button>
          <button type="button" className="pill" onClick={openML}>
            Mercado Libre
          </button>
          <button type="button" className="pill" onClick={abrirModalPD}>
            URL Parte Diaria
          </button>

          <input
            className="search"
            placeholder="Buscar móvil, patente, tamaño o modelo…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
        </div>
      </div>

      <main className="list">{cards}</main>

      {showPdModal && (
        <div
          className="modal-overlay"
          onClick={(e) =>
            (e.target as HTMLElement).classList.contains('modal-overlay') && setShowPdModal(false)
          }
        >
          <div className="modal">
            <h3 style={{ margin: '0 0 8px' }}>Parte diaria — URL privada</h3>

            <label className="modal-label">Nº de móvil</label>
            <input
              className="modal-input"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pdMovil}
              onChange={(e) => setPdMovil(e.currentTarget.value.replace(/\D/g, ''))}
              placeholder="Ej: 3"
            />

            <label className="modal-checkbox">
              <input
                type="checkbox"
                checked={pdRegen}
                onChange={(e) => setPdRegen(e.currentTarget.checked)}
              />
              Regenerar clave privada (invalidará la anterior)
            </label>

            {pdUrl && (
              <>
                <label className="modal-label" style={{ marginTop: 10 }}>
                  URL generada
                </label>
                <input className="modal-input" value={pdUrl} readOnly />

                <div className="qr-box">
                  <img src={pdQr} alt="QR Parte Diaria" />
                </div>
              </>
            )}

            <div className="modal-actions">
              {!pdUrl && (
                <button type="button" className="btn" onClick={confirmarPD} disabled={pdLoading}>
                  {pdLoading ? 'Generando…' : 'Generar URL'}
                </button>
              )}

              {pdUrl && (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => navigator.clipboard?.writeText(pdUrl)}
                  >
                    Copiar
                  </button>

                  <a href={pdUrl} target="_blank" rel="noreferrer">
                    <button type="button" className="btn">
                      Abrir
                    </button>
                  </a>
                </>
              )}

              <button type="button" className="btn btn--ghost" onClick={() => setShowPdModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
