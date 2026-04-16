import React, { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, matchPath, useLocation, useNavigate } from 'react-router-dom'
import { clearAuth } from '@/lib/auth'

function fire(name: string) {
  window.dispatchEvent(new Event(name))
}

export default function TopNavbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const movilCtx = matchPath({ path: '/movil/:movilId/*', end: false }, pathname)
  const movilId = movilCtx?.params?.movilId ? String(movilCtx.params.movilId) : ''

  const isArreglosPorMovil = !!matchPath({ path: '/movil/:movilId', end: true }, pathname)

  const links = useMemo(() => {
    const inMovil = !!movilId
    return {
      home: '/',
      finalizados: inMovil ? `/movil/${encodeURIComponent(movilId)}/finalizados` : '/finalizados',
      historialPatente: inMovil ? `/movil/${encodeURIComponent(movilId)}/historial` : '/historial',
      historialDia: inMovil ? `/movil/${encodeURIComponent(movilId)}/historial-dia` : '/historial-dia',
    }
  }, [movilId])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!isArreglosPorMovil) setOpen(false)
  }, [isArreglosPorMovil])

  const handleLogout = () => {
    try {
      clearAuth()
    } catch {
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('ts_logged')
      } catch {
        // noop
      }
    }

    setOpen(false)
    navigate('/login', { replace: true })
  }

  return (
    <div className="topnavWrap" ref={wrapRef}>
      <header className="topnav">
        <div className="topnav__left">
          <div className="topnav__logo" aria-label="MEDIC Taller">
            <span className="topnav__logo-mark">M</span>
            <span className="topnav__logo-text">MEDIC Taller</span>
          </div>

          <nav className="topnav__nav" aria-label="Navegación">
            <NavLink
              to={links.home}
              className={({ isActive }) => `topnav__nav-item ${isActive ? 'topnav__nav-item--active' : ''}`}
            >
              Home
            </NavLink>

            <NavLink
              to={links.finalizados}
              className={({ isActive }) => `topnav__nav-item ${isActive ? 'topnav__nav-item--active' : ''}`}
            >
              Ver arreglos finalizados
            </NavLink>

            <NavLink
              to={links.historialPatente}
              className={({ isActive }) => `topnav__nav-item ${isActive ? 'topnav__nav-item--active' : ''}`}
            >
              Historial por patente
            </NavLink>

            <NavLink
              to={links.historialDia}
              className={({ isActive }) => `topnav__nav-item ${isActive ? 'topnav__nav-item--active' : ''}`}
            >
              Historial del día
            </NavLink>
          </nav>
        </div>

        <div className="topnav__right">
          {isArreglosPorMovil && (
            <button
              type="button"
              className={`topnav__smart ${open ? 'topnav__smart--open' : ''}`}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="topnavDrop"
              title="Abrir filtros y acciones"
            >
              <span className="topnav__smart-label">Filtros y acciones</span>
              <span className="topnav__smart-caret">{open ? '▴' : '▾'}</span>
            </button>
          )}

          {movilId ? <div className="topnav__badge">Móvil {movilId}</div> : null}

          <button
            type="button"
            className="topnav__logout"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {isArreglosPorMovil && open && (
        <div className="topnavDrop" id="topnavDrop">
          <div className="topnavDrop__inner">
            <div className="topnavDrop__section">
              <div className="topnavDrop__title">Arreglos</div>
              <div className="actions">
                <button type="button" className="pill" onClick={() => fire('ts:arreglos:nuevo')} title="Nuevo arreglo">
                  ➕ <span>Nuevo</span>
                </button>

                <button
                  type="button"
                  className="pill"
                  onClick={() => fire('ts:arreglos:editar-ultimo')}
                  title="Editar último seleccionado"
                >
                  ✏️ <span>Editar</span>
                </button>

                <button
                  type="button"
                  className="pill"
                  onClick={() => fire('ts:arreglos:toggle-eliminar')}
                  title="Alternar modo eliminar"
                >
                  🗑️ <span>Eliminar</span>
                </button>
              </div>
            </div>

            <div className="topnavDrop__divider" />

            <div className="topnavDrop__section">
              <div className="topnavDrop__title">Vistas</div>
              <div className="actions">
                <NavLink to={links.finalizados} className="pill" onClick={() => setOpen(false)}>
                  ✅ <span>Ver finalizados</span>
                </NavLink>

                <NavLink to={links.historialPatente} className="pill" onClick={() => setOpen(false)}>
                  🔎 <span>Historial patente</span>
                </NavLink>

                <NavLink to={links.historialDia} className="pill" onClick={() => setOpen(false)}>
                  📅 <span>Historial del día</span>
                </NavLink>
              </div>
            </div>

            <div className="topnavDrop__divider" />

            <div className="topnavDrop__section">
              <div className="topnavDrop__title">Acciones</div>
              <div className="actions">
                <button
                  type="button"
                  className="pill pill--primary"
                  onClick={() => fire('ts:arreglos:finalizar')}
                  title="Finalizar arreglos (mover Done a Finalizados)"
                >
                  🏁 <span>Finalizar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
