import React, { useEffect, useMemo, useRef, useState } from 'react'

export type CompanyDraft = {
  nombre: string
  nroSocio: string
  cuit: string
  contacto: string
  telefono: string
  email: string
  domicilio: string
  notas: string
}

const empty: CompanyDraft = {
  nombre: '',
  nroSocio: '',
  cuit: '',
  contacto: '',
  telefono: '',
  email: '',
  domicilio: '',
  notas: '',
}

export default function AddCompanyModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (draft: CompanyDraft) => void
}) {
  const [d, setD] = useState<CompanyDraft>(empty)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  // ✅ hooks SIEMPRE arriba, sin returns antes
  const canSave = useMemo(() => d.nombre.trim().length > 0, [d.nombre])

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)

    requestAnimationFrame(() => firstInputRef.current?.focus())

    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-full" role="dialog" aria-modal="true">
      <div className="modal-full__backdrop" onClick={onClose} />
      <div className="modal-full__panel">
        <div className="modal-full__header">
          <div>
            <h3 className="modal-full__title">Agregar empresa / socio</h3>
            <p className="modal-full__sub">
              Completar datos básicos (por ahora se guarda en localStorage).
            </p>
          </div>

          <button className="btn btn--outline" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>

        <div className="modal-full__body">
          <div className="modal-grid">
            <label className="modal-label">
              Empresa / Razón social
              <input
                ref={firstInputRef}
                className="input"
                value={d.nombre}
                onChange={(e) => setD((p) => ({ ...p, nombre: e.target.value }))}
              />
            </label>

            <label className="modal-label">
              N° de socio (si aplica)
              <input
                className="input"
                value={d.nroSocio}
                onChange={(e) => setD((p) => ({ ...p, nroSocio: e.target.value }))}
              />
            </label>

            <label className="modal-label">
              CUIT
              <input
                className="input"
                value={d.cuit}
                onChange={(e) => setD((p) => ({ ...p, cuit: e.target.value }))}
              />
            </label>

            <label className="modal-label">
              Contacto
              <input
                className="input"
                value={d.contacto}
                onChange={(e) => setD((p) => ({ ...p, contacto: e.target.value }))}
              />
            </label>

            <label className="modal-label">
              Teléfono
              <input
                className="input"
                value={d.telefono}
                onChange={(e) => setD((p) => ({ ...p, telefono: e.target.value }))}
              />
            </label>

            <label className="modal-label">
              Email
              <input
                className="input"
                value={d.email}
                onChange={(e) => setD((p) => ({ ...p, email: e.target.value }))}
              />
            </label>

            <label className="modal-label modal-label--full">
              Domicilio
              <input
                className="input"
                value={d.domicilio}
                onChange={(e) => setD((p) => ({ ...p, domicilio: e.target.value }))}
              />
            </label>

            <label className="modal-label modal-label--full">
              Notas
              <textarea
                className="input modal-textarea"
                value={d.notas}
                onChange={(e) => setD((p) => ({ ...p, notas: e.target.value }))}
                placeholder="Observaciones internas…"
              />
            </label>
          </div>
        </div>

        <div className="modal-full__footer">
          <button
            className="btn btn--outline"
            type="button"
            onClick={() => {
              setD(empty)
              onClose()
            }}
          >
            Cancelar
          </button>

          <button
            className="btn btn--primary"
            type="button"
            disabled={!canSave}
            onClick={() => {
              onSubmit({
                nombre: d.nombre.trim(),
                nroSocio: d.nroSocio.trim(),
                cuit: d.cuit.trim(),
                contacto: d.contacto.trim(),
                telefono: d.telefono.trim(),
                email: d.email.trim(),
                domicilio: d.domicilio.trim(),
                notas: d.notas.trim(),
              })
              setD(empty)
              onClose()
            }}
          >
            Guardar empresa
          </button>
        </div>
      </div>
    </div>
  )
}
