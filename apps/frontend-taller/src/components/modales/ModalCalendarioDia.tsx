import React from 'react'

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

type Props = {
  open: boolean
  data: DiaDetalle | null
  onClose: () => void
}

function prioLabel(p: Prioridad) {
  return p === 'urgente' ? 'Urgente' : p === 'alta' ? 'Alta' : 'Baja'
}

export default function ModalCalendarioDia({ open, data, onClose }: Props) {
  if (!open || !data) return null

  return (
    <div
      className="modal-overlay"
      onClick={(e) => (e.target as HTMLElement).classList.contains('modal-overlay') && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal" style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Resumen del día</h3>
            <div style={{ opacity: 0.8, marginTop: 4 }}>
              <strong>{data.fecha}</strong> · Prioridad máx: <strong>{prioLabel(data.prioridadMax)}</strong>
            </div>
          </div>

          <button className="btn ghost" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          <h4 style={{ margin: '10px 0' }}>Arreglos ({data.arreglos.length})</h4>

          {data.arreglos.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No hay arreglos registrados ese día.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {data.arreglos.map((a) => (
                <div key={a.id} className={`kb-card prio-${String(a.prioridad).toLowerCase()}`} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{a.patente || '—'}</strong>
                      {a.motivo ? <div style={{ marginTop: 4 }}>📌 {a.motivo}</div> : null}
                    </div>
                    <div style={{ opacity: 0.8 }}>Prioridad: <strong>{prioLabel(a.prioridad)}</strong></div>
                  </div>

                  {a.anotaciones ? <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{a.anotaciones}</div> : null}

                  {a.tareas?.length ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Tareas</div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        {a.tareas.map((t) => (
                          <div key={t.id} style={{ opacity: t.completa ? 0.7 : 1 }}>
                            {t.completa ? '✔' : '•'} {t.texto}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <h4 style={{ margin: '16px 0 10px' }}>Parte diario ({data.partes.length})</h4>
          {data.partes.length === 0 ? (
            <div style={{ opacity: 0.8 }}>No hay parte diario registrado ese día.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {data.partes.map((p) => (
                <div key={p.id} className="card" style={{ padding: 10 }}>
                  <div>
                    Chofer: <strong>{p.chofer || '—'}</strong>
                  </div>
                  <div style={{ opacity: 0.9 }}>
                    Km inicio: <strong>{p.km_inicio ?? '—'}</strong> · Km fin: <strong>{p.km_fin ?? '—'}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
