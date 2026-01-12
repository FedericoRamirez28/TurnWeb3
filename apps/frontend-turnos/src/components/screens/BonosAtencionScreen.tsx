import React, { useEffect, useMemo, useState } from 'react'
import type { Affiliate, Appointment } from '@/components/screens/homeModels'
import Swal from 'sweetalert2'
import { fetchPrestadores, type PrestadorListItem } from '@/api/bonosAtencionApi'

type Props = {
  affiliates: Affiliate[]
  appointments: Appointment[]
}

const getLocalISOString = () => {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

export default function BonosAtencionScreen({ affiliates, appointments }: Props) {
  const [prestadores, setPrestadores] = useState<PrestadorListItem[]>([])
  const [loadingPres, setLoadingPres] = useState(false)
  const [errorPres, setErrorPres] = useState<string | null>(null)

  const [afiliadoId, setAfiliadoId] = useState('')
  const [prestadorId, setPrestadorId] = useState('')
  const [turnoId, setTurnoId] = useState('')
  const [venceDias, setVenceDias] = useState<number>(7)
  const [fechaISO, setFechaISO] = useState<string>(getLocalISOString())
  const [practica, setPractica] = useState('')
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingPres(true)
      setErrorPres(null)
      try {
        const list = await fetchPrestadores()
        if (!alive) return
        setPrestadores(list)
      } catch (e) {
        console.error('[BonosAtencion] prestadores error', e)
        if (!alive) return
        setErrorPres('No se pudieron cargar los prestadores. Revisá el endpoint /prestadores/active.')
      } finally {
        if (!alive) return
        setLoadingPres(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const selectedAffiliate = useMemo(
    () => affiliates.find((a) => a.id === afiliadoId) ?? null,
    [affiliates, afiliadoId],
  )

  const turnosDelAfiliado = useMemo(() => {
    if (!afiliadoId) return []
    return appointments
      .filter((t) => t.affiliateId === afiliadoId && t.estado !== 'cancelado')
      .slice()
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  }, [appointments, afiliadoId])

  const handleEmitir = async () => {
    if (!afiliadoId) return void Swal.fire('Error', 'Elegí un afiliado', 'error')
    if (!prestadorId) return void Swal.fire('Error', 'Elegí un prestador', 'error')
    if (!practica.trim()) return void Swal.fire('Error', 'Completá la práctica', 'error')

    // próximo paso: POST /bonos-atencion y generar PDF
    return void Swal.fire('OK', 'Listo. Próximo paso: crear bono en backend + PDF QR.', 'success')
  }

  return (
    <section className="bonos-screen card card--stretch">
      <header className="card__header">
        <div>
          <h2 className="card__title">Bono de Atención</h2>
          <p className="card__subtitle">Generá un bono verificable por QR (un solo uso).</p>
          <p className="card__subtitle" style={{ opacity: 0.75, marginTop: 6 }}>
            Debug: {affiliates.length} afiliados · {prestadores.length} prestadores
          </p>
        </div>

        <button className="btn btn--primary" type="button" onClick={() => void handleEmitir()}>
          Emitir PDF
        </button>
      </header>

      {loadingPres && <div className="alert alert--info">Cargando prestadores…</div>}
      {errorPres && (
        <div className="alert alert--danger">
          <b>Error:</b> {errorPres}
        </div>
      )}

      <div className="bonos-grid">
        <label className="field">
          <span className="field__label">Afiliado</span>
          <select className="input" value={afiliadoId} onChange={(e) => setAfiliadoId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {affiliates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombreCompleto} · DNI {a.dni} · Nº {a.numeroAfiliado}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Prestador</span>
          <select className="input" value={prestadorId} onChange={(e) => setPrestadorId(e.target.value)}>
            <option value="">Seleccionar…</option>
            {prestadores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Turno (opcional)</span>
          <select className="input" value={turnoId} onChange={(e) => setTurnoId(e.target.value)} disabled={!selectedAffiliate}>
            <option value="">Sin turno…</option>
            {turnosDelAfiliado.map((t) => (
              <option key={t.id} value={t.id}>
                {t.date} {t.time} · {t.tipoAtencion === 'laboratorio' ? t.laboratorio : t.especialidad}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Vence en (días)</span>
          <input
            className="input"
            type="number"
            min={1}
            value={venceDias}
            onChange={(e) => setVenceDias(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>

        <label className="field">
          <span className="field__label">Fecha sugerida (YYYY-MM-DD)</span>
          <input className="input" value={fechaISO} onChange={(e) => setFechaISO(e.target.value)} />
        </label>

        <label className="field">
          <span className="field__label">Práctica</span>
          <input className="input" value={practica} onChange={(e) => setPractica(e.target.value)} placeholder="Ej: Cardiología / ECG / Laboratorio…" />
        </label>

        <label className="field field--full">
          <span className="field__label">Observaciones</span>
          <textarea className="input" rows={5} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </label>
      </div>
    </section>
  )
}
