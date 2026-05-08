import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'
import { requestPasswordReset, resetPassword } from '@/api/authApi'

type Mode = 'login' | 'register'

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Error'
}

export default function LoginScreen() {
  const { login, register, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [mode, setMode] = useState<Mode>('login')
  const [remember, setRemember] = useState(true)

  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [failedOnce, setFailedOnce] = useState(false)

  const [showRecover, setShowRecover] = useState(false)
  const [recoverToken, setRecoverToken] = useState<string | null>(null)
  const [recoverNewPass, setRecoverNewPass] = useState('')

  const title = useMemo(
    () => (mode === 'login' ? 'Iniciar sesión' : 'Crear usuario'),
    [mode],
  )

  // Si ya está logueado y cae en /login, lo mandamos al home
  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true })
    }
  }, [loading, user, navigate])

  // Al cambiar modo, limpiamos errores / recover
  useEffect(() => {
    setError(null)
    setFailedOnce(false)
    setShowRecover(false)
    setRecoverToken(null)
    setRecoverNewPass('')
  }, [mode])

  const redirectAfterAuth = () => {
    const state = location.state as { from?: string } | null
    const to = state?.from && typeof state.from === 'string' ? state.from : '/'
    navigate(to, { replace: true })
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)

    try {
      if (mode === 'login') {
        await login(username, password, remember)
      } else {
        await register(username, password, displayName, remember)
      }
      redirectAfterAuth()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
      if (mode === 'login') setFailedOnce(true)
    } finally {
      setBusy(false)
    }
  }

  const onRequestReset = async () => {
    setError(null)
    setBusy(true)
    try {
      const token = await requestPasswordReset(username)
      setRecoverToken(token)
      setShowRecover(true)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const onApplyReset = async () => {
    if (!recoverToken) return
    setError(null)
    setBusy(true)
    try {
      await resetPassword(recoverToken, recoverNewPass)
      setShowRecover(false)
      setRecoverToken(null)
      setRecoverNewPass('')
      setError('Contraseña actualizada. Ya podés iniciar sesión.')
      setMode('login')
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <div className="login__mark">M</div>
          <div className="login__brand-text">
            <div className="login__brand-title">MEDIC Laboral</div>
            <div className="login__brand-sub">Acceso del sistema</div>
          </div>
        </div>

        <div className="login__tabs">
          <button
            type="button"
            className={'login__tab' + (mode === 'login' ? ' login__tab--active' : '')}
            onClick={() => setMode('login')}
            disabled={busy}
          >
            Entrar
          </button>
          <button
            type="button"
            className={'login__tab' + (mode === 'register' ? ' login__tab--active' : '')}
            onClick={() => setMode('register')}
            disabled={busy}
          >
            Crear usuario
          </button>
        </div>

        <h1 className="login__title">{title}</h1>

        <form className="login__form" onSubmit={onSubmit}>
          <label className="login__field">
            <span className="login__label">Usuario</span>
            <input
              className="login__input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="recepcion.sanjusto"
              autoComplete="username"
            />
          </label>

          {mode === 'register' && (
            <label className="login__field">
              <span className="login__label">Nombre visible (opcional)</span>
              <input
                className="login__input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Recepción San Justo"
                autoComplete="nickname"
              />
            </label>
          )}

          <label className="login__field">
            <span className="login__label">Contraseña</span>
            <input
              className="login__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <label className="login__remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={busy}
            />
            <span>Mantener sesión iniciada</span>
          </label>

          {error && <div className="login__error">{error}</div>}

          <button className="login__submit" type="submit" disabled={busy}>
            {busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear y entrar'}
          </button>

          {mode === 'login' && failedOnce && (
            <button
              className="login__link"
              type="button"
              onClick={onRequestReset}
              disabled={busy || !username.trim()}
              title={!username.trim() ? 'Completá el usuario para recuperar' : 'Recuperar contraseña'}
            >
              ¿Olvidaste tu contraseña? Recuperar
            </button>
          )}
        </form>

        {showRecover && recoverToken && (
          <div className="login__recover">
            <div className="login__recover-title">Recuperar contraseña</div>
            <div className="login__recover-sub">
              Se generó una autorización temporal para cambiar la contraseña.
            </div>

            <label className="login__field">
              <span className="login__label">Nueva contraseña</span>
              <input
                className="login__input"
                value={recoverNewPass}
                onChange={(e) => setRecoverNewPass(e.target.value)}
                type="password"
                placeholder="Nueva contraseña"
              />
            </label>

            <div className="login__recover-actions">
              <button
                className="login__btn-soft"
                type="button"
                onClick={() => setShowRecover(false)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="login__btn-solid"
                type="button"
                onClick={onApplyReset}
                disabled={busy || recoverNewPass.length < 4}
              >
                Confirmar cambio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
