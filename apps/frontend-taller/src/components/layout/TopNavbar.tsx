// src/components/ui/TopNavbar.tsx
import React, { useMemo } from 'react'
import { NavLink, matchPath, useLocation } from 'react-router-dom'

import '@/styles/components/ui/TopNavbar.scss'

function fire(name: string) {
  window.dispatchEvent(new Event(name))
}

export default function TopNavbar() {
  const { pathname } = useLocation()

  // Contexto móvil (para links /movil/:id/*)
  const movilCtx = matchPath({ path: '/movil/:movilId/*', end: false }, pathname)
  const movilId = movilCtx?.params?.movilId ? String(movilCtx.params.movilId) : ''

  // ✅ SOLO en ArreglosScreen (/movil/:id) mostramos acciones
  const isArreglosPorMovil = !!matchPath({ path: '/movil/:movilId', end: true }, pathname)

  const links = useMemo(() => {
    const inMovil = !!movilId
    return {
      home: '/',
      finalizados: inMovil ? `/movil/${encodeURIComponent(movilId)}/finalizados` : '/finalizados',
      historialPatente: inMovil ? `/movil/${encodeURIComponent(movilId)}/historial` : '/historial-patentes',
      historialDia: inMovil ? `/movil/${encodeURIComponent(movilId)}/historial-dia` : '/historial-dia',
    }
  }, [movilId])

  return (
    <header className="topnav">
      <div className="topnav__left">
        <div className="topnav__brand" aria-label="MEDIC Taller">
          <span className="topnav__logo">M</span>
          <span className="topnav__title">MEDIC Taller</span>
        </div>

        <nav className="topnav__links" aria-label="Navegación">
          <NavLink to={links.home} className={({ isActive }) => `topnav__link ${isActive ? 'active' : ''}`}>
            Home
          </NavLink>

          <NavLink
            to={links.finalizados}
            className={({ isActive }) => `topnav__link ${isActive ? 'active' : ''}`}
          >
            Ver arreglos finalizados
          </NavLink>

          <NavLink
            to={links.historialPatente}
            className={({ isActive }) => `topnav__link ${isActive ? 'active' : ''}`}
          >
            Historial por patente
          </NavLink>

          <NavLink
            to={links.historialDia}
            className={({ isActive }) => `topnav__link ${isActive ? 'active' : ''}`}
          >
            Historial del día
          </NavLink>
        </nav>
      </div>

      <div className="topnav__right">
        {isArreglosPorMovil && (
          <div className="topnav__actions" aria-label="Acciones de arreglos">
            <button type="button" className="navbtn" onClick={() => fire('ts:arreglos:nuevo')} title="Nuevo arreglo">
              ➕ <span>Nuevo</span>
            </button>

            <button type="button" className="navbtn" onClick={() => fire('ts:arreglos:editar-ultimo')} title="Editar último seleccionado">
              ✏️ <span>Editar</span>
            </button>

            <button type="button" className="navbtn" onClick={() => fire('ts:arreglos:toggle-eliminar')} title="Alternar modo eliminar">
              🗑️ <span>Eliminar</span>
            </button>

            <button type="button" className="navbtn navbtn--primary" onClick={() => fire('ts:arreglos:finalizar')} title="Finalizar arreglos (mover Done a Finalizados)">
              🏁 <span>Finalizar</span>
            </button>
          </div>
        )}

        {movilId ? <div className="topnav__movil">Móvil {movilId}</div> : null}
      </div>
    </header>
  )
}
