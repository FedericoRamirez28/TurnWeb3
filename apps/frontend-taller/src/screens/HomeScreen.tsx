// apps/frontend-taller/src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ambulanceImg from '../../assets/images/ambulance.png'
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

type StripeStatus = 'alert' | 'warn' | 'ok'
type Prioridad = 'baja' | 'alta' | 'urgente'
type Filtro = 'todos' | Prioridad

type PrioridadesMap = Record<string, Prioridad>
type PatentesMap = Record<string, string>

function StatusStripe({ status }: { status?: StripeStatus | null }) {
  if (!status) return null
  return <span className={`stripe ${status}`} />
}

function buildMovilPath(id: number) {
  // ✅ click en la tarjeta => ArreglosScreen
  return `/movil/${encodeURIComponent(String(id))}`
}

function buildParteDiariaPath(id: number) {
  // ✅ botones URL => ParteDiariaScreen
  return `/parte-diaria?movilId=${encodeURIComponent(String(id))}`
}

function buildAbsoluteUrl(path: string) {
  // soporta prod/dev sin hardcodear host
  const origin = window.location.origin
  return `${origin}${path}`
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // fallback
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      ta.style.top = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function AmbulanceCard({
  id,
  status,
  tamano,
  modelo,
  patente,
}: {
  id: number
  status?: StripeStatus | null
  tamano: string
  modelo: string
  patente?: string
}) {
  const nav = useNavigate()
  const [copied, setCopied] = useState(false)

  const movilPath = useMemo(() => buildMovilPath(id), [id])
  const partePath = useMemo(() => buildParteDiariaPath(id), [id])
  const absoluteParteUrl = useMemo(() => buildAbsoluteUrl(partePath), [partePath])

  const go = () => nav(movilPath)

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const ok = await copyToClipboard(absoluteParteUrl)
    setCopied(ok)
    setTimeout(() => setCopied(false), 1200)
  }

  const onOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.open(absoluteParteUrl, '_blank', 'noopener,noreferrer')
  }

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

      {/* ✅ Botones URL (apuntan a ParteDiariaScreen) */}
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="card-url-btn" onClick={onCopy} title="Copiar URL del parte diario">
          🔗 {copied ? 'Copiado' : 'URL'}
        </button>

        <button type="button" className="card-open-btn" onClick={onOpen} title="Abrir parte diario en otra pestaña">
          ↗ Abrir
        </button>
      </div>

      <div className="meta">
        <div className="meta-line meta-tamano">{tamano}</div>
        <div className="meta-line meta-modelo">{modelo}</div>
        {!!patente && <div className="meta-line meta-patente">{patente}</div>}
      </div>
    </button>
  )
}

export default function HomeScreen() {
  const [prioMap, setPrioMap] = useState<PrioridadesMap>({})
  const [patentesMap, setPatentesMap] = useState<PatentesMap>({})
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [q, setQ] = useState('')
  const [loadingMaps, setLoadingMaps] = useState(false)

  const fetchMaps = useCallback(async () => {
    setLoadingMaps(true)
    try {
      const [rPrio, rInfo] = await Promise.all([
        api.get<PrioridadesMap>('/moviles/prioridades-map'),
        api.get<PatentesMap>('/moviles/info-map'),
      ])

      if (rPrio.ok) setPrioMap(rPrio.data || {})
      else console.error('[home] prioridades-map:', rPrio.error)

      if (rInfo.ok) setPatentesMap(rInfo.data || {})
      else console.error('[home] info-map:', rInfo.error)
    } finally {
      setLoadingMaps(false)
    }
  }, [])

  useEffect(() => {
    fetchMaps()
  }, [fetchMaps])

  useEffect(() => {
    const onRefresh = () => fetchMaps()
    window.addEventListener('ts:home:refresh', onRefresh)
    return () => window.removeEventListener('ts:home:refresh', onRefresh)
  }, [fetchMaps])

  useEffect(() => {
    const onFocus = () => fetchMaps()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchMaps])

  const stripeByMovil = useMemo(() => {
    const map: Record<string, StripeStatus | null> = {}
    for (const id of Object.keys(prioMap || {})) {
      const pr = prioMap[id]
      map[id] = pr === 'urgente' ? 'alert' : pr === 'alta' ? 'warn' : pr === 'baja' ? 'ok' : null
    }
    return map
  }, [prioMap])

  const ambFiltradas = useMemo(() => {
    const term = q.trim().toLowerCase()

    return AMBULANCIAS.filter((a) => {
      const idStr = String(a.id)
      const pr = prioMap?.[idStr]

      if (filtro !== 'todos' && pr !== filtro) return false
      if (!term) return true

      const pat = (patentesMap?.[idStr] || '').toLowerCase()

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
          patente={patentesMap?.[String(a.id)] || ''}
          status={stripeByMovil?.[String(a.id)] || null}
        />
      )),
    [ambFiltradas, stripeByMovil, patentesMap],
  )

  const Btn = ({ value, children }: { value: Filtro; children: React.ReactNode }) => (
    <button type="button" className={`pill-toggle ${filtro === value ? 'active' : ''}`} onClick={() => setFiltro(value)}>
      {children}
    </button>
  )

  return (
    <div className="ts-home">
      <div style={{ padding: '10px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn value="todos">Todos</Btn>
          <Btn value="urgente">Urgente</Btn>
          <Btn value="alta">Alta</Btn>
          <Btn value="baja">Baja</Btn>

          <button
            type="button"
            className="pill-toggle"
            onClick={fetchMaps}
            title="Actualizar estado"
            style={{ opacity: loadingMaps ? 0.7 : 1 }}
          >
            ↻ Actualizar
          </button>
        </div>

        <input
          className="input"
          style={{ minWidth: 260, flex: '1 1 320px' }}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="Buscar por móvil, patente, tamaño o modelo…"
        />
      </div>

      <main className="list">{cards}</main>
    </div>
  )
}
