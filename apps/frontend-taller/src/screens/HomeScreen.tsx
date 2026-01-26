// src/screens/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApiResult } from '@/lib/types'

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

export default function HomeScreen() {
  const [prioMap, setPrioMap] = useState<PrioridadesMap>({})
  const [patentesMap, setPatentesMap] = useState<PatentesMap>({})
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [q, setQ] = useState('')

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

  return (
    <div className="ts-home">
      {/* ✅ BarraOpciones ELIMINADA: ahora todo va por TopNavbar */}
      <div style={{ padding: '10px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn value="todos">Todos</Btn>
          <Btn value="urgente">Urgente</Btn>
          <Btn value="alta">Alta</Btn>
          <Btn value="baja">Baja</Btn>
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
