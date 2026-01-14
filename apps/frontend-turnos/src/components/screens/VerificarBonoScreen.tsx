// apps/frontend-turnos/src/components/screens/VerificarBonoScreen.tsx

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { usarBono, verificarBono, type BonoVerifyResp } from '@/api/bonosAtencionApi'

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}

export const VerificarBonoScreen: React.FC = () => {
  const { user } = useAuth()
  const isPrestador = useMemo(() => String(user?.role ?? '').toLowerCase() === 'prestador', [user])

  const { code = '' } = useParams()
  const [sp] = useSearchParams()
  const token = sp.get('t') ?? ''

  const [data, setData] = useState<BonoVerifyResp | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setErr(null)
    try {
      const r = await verificarBono(code, token)
      setData(r)
    } catch (e: unknown) {
      setData(null)
      setErr(getErrorMessage(e))
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, token])

  const marcarUsado = async () => {
    if (!isPrestador) return
    setBusy(true)
    setErr(null)
    try {
      await usarBono(code)
      await load()
    } catch (e: unknown) {
      setErr(getErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="home__placeholder" style={{ padding: 18 }}>
      <div className="home__placeholder-card card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <h2 className="card__title">Verificación de Bono</h2>

        {err && (
          <div style={{ padding: 12, borderRadius: 12, background: 'rgba(239,68,68,0.12)' }}>
            <b>Error:</b> {err}
          </div>
        )}

        {!err && !data && <p className="card__subtitle">Cargando…</p>}

        {data && (
          <>
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                background: data.ok ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.14)',
              }}
            >
              <b>
                {data.ok
                  ? '✅ BONO VÁLIDO'
                  : data.status === 'USED'
                    ? '⚠️ YA UTILIZADO'
                    : data.status === 'EXPIRED'
                      ? '⏳ VENCIDO'
                      : '❌ CANCELADO'}
              </b>
            </div>

            <div style={{ marginTop: 12, lineHeight: 1.8 }}>
              <div>
                <b>Código:</b> {data.bono.code}
              </div>
              <div>
                <b>Afiliado:</b> {data.bono.afiliadoNombreSnap}
              </div>
              <div>
                <b>DNI:</b> {data.bono.afiliadoDniSnap}
              </div>
              <div>
                <b>Prestador:</b> {data.bono.prestadorNombreSnap}
              </div>
              <div>
                <b>Práctica:</b> {data.bono.practica}
              </div>

              {data.bono.fechaAtencionISO ? (
                <div>
                  <b>Fecha sugerida:</b> {data.bono.fechaAtencionISO}
                </div>
              ) : null}

              <div>
                <b>Vence:</b> {new Date(data.bono.expiresAt).toLocaleString()}
              </div>

              {data.bono.usedAt ? (
                <div>
                  <b>Usado:</b> {new Date(data.bono.usedAt).toLocaleString()}
                </div>
              ) : null}
            </div>

            {isPrestador && data.ok && (
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn--primary" disabled={busy} onClick={marcarUsado}>
                  {busy ? 'Marcando…' : 'Marcar como usado'}
                </button>
              </div>
            )}

            {!isPrestador && (
              <p style={{ marginTop: 12, opacity: 0.75 }}>
                Para marcar el bono como usado, el prestador debe iniciar sesión.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
