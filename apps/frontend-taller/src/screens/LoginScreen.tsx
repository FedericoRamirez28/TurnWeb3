import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import logo from '../../assets/images/logo-hd.png'

import { api } from '@/lib/api'
import { setToken, setUser, clearAuth, type AuthUser } from '@/lib/auth'

type LoginPayload = { token: string; user: AuthUser }
type LoginResponse = { ok: true; data: LoginPayload } | { ok: false; error: string }

export default function LoginScreen() {
  const nav = useNavigate()
  const loc = useLocation()

  const nextPath = useMemo(() => {
    const sp = new URLSearchParams(loc.search || '')
    const next = sp.get('next') || '/'
    if (!next.startsWith('/')) return '/'
    return next
  }, [loc.search])

  const [email, setEmail] = useState('admin@taller.local')
  const [pass, setPass] = useState('admin1234')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin(e?: React.FormEvent) {
    e?.preventDefault?.()
    if (loading) return

    setError('')
    setLoading(true)

    try {
      clearAuth()

      const r = await api.post<LoginResponse>('/auth/login', {
        email,
        password: pass,
      })

      if (!r.ok) {
        setError(r.error || 'No se pudo iniciar sesión.')
        return
      }

      // ✅ ApiResult: token y user vienen dentro de data
      const token = (r.data as any)?.data?.token ?? (r.data as any)?.token
      const user = (r.data as any)?.data?.user ?? (r.data as any)?.user

      if (!token) {
        setError('Respuesta inválida del servidor (sin token).')
        return
      }

      setToken(String(token))
      setUser((user as AuthUser) ?? null)

      nav(nextPath || '/', { replace: true })
    } catch (err) {
      console.error('[login] error', err)
      setError('No se pudo conectar con el servidor (network/CORS).')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src={logo} alt="Taller Solutions" className="login-logo" />
        <h1 className="login-title">Taller Solutions</h1>
        <p className="login-subtitle">Acceso restringido</p>

        <form className="login-form" onSubmit={doLogin}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="admin@taller.local"
              required
              disabled={loading}
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <div className="password-box">
              <input
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={pass}
                onChange={(e) => setPass(e.currentTarget.value)}
                placeholder="••••••••"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="toggle"
                onClick={() => setShowPass((v) => !v)}
                disabled={loading}
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          {error && <div className="error">{error}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <details className="admin-tools">
          <summary>Ayuda</summary>
          <div className="pin-setup">
            <p className="hint">
              Usuario inicial : <b>admin@taller.local</b>
              <br />
              Password: <b>admin1234</b>
            </p>
            <p className="hint" style={{ marginTop: 8 }}>
              API: <b>{String((import.meta as any).env?.VITE_API_BASE || 'http://localhost:3001')}</b>
            </p>
          </div>
        </details>
      </div>
    </div>
  )
}
