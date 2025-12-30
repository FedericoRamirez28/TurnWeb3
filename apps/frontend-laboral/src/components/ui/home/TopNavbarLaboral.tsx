import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/useAuth'

export type NavKeyLaboral = 'home' | 'precios' | 'config' | 'preocupacional' | 'portada' | 'adicionales' | 'ecg' | 'consultorios'

const NAV_ITEMS: { key: NavKeyLaboral; label: string; path: string }[] = [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'preocupacional', label: 'Preocupacional', path: '/preocupacional' },
  { key: 'portada', label: 'Portada Clinica', path: '/portada' },
  { key: 'consultorios', label: 'Turnos Consultorios', path: '/consultorios' },
  { key: 'adicionales', label: 'Adicionales', path: '/adicionales' },
  { key: 'precios', label: 'Precios', path: '/precios' },
  // { key: 'ecg', label: 'ECG Captura', path: '/ecg' },
  // { key: 'config', label: 'Configuración', path: '/config' },
]

function getSelected(pathname: string): NavKeyLaboral {
  if (pathname.startsWith('/precios')) return 'precios'
  if (pathname.startsWith('/preocupacional')) return 'preocupacional'
  if (pathname.startsWith('/portada')) return 'portada'
  if (pathname.startsWith('/adicionales')) return 'adicionales'
  if (pathname.startsWith('/consultorios')) return 'consultorios'
  if (pathname.startsWith('/ecg')) return 'ecg'
  if (pathname.startsWith('/config')) return 'config'
  return 'home'
}

export const TopNavbarLaboral: React.FC = () => {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()

  const selected = getSelected(loc.pathname)

  return (
    <header className="topnav">
      <div className="topnav__left">
        <div className="topnav__logo">
          <span className="topnav__logo-mark">M</span>
          <span className="topnav__logo-text">MEDIC Laboral</span>
        </div>

        <nav className="topnav__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={
                'topnav__nav-item' + (selected === item.key ? ' topnav__nav-item--active' : '')
              }
              onClick={() => nav(item.path)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="topnav__right">
        <span className="topnav__user">{user?.displayName ?? user?.username ?? 'Usuario'}</span>
        <button className="topnav__logout" type="button" onClick={() => logout()}>
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
