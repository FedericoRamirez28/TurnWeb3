import React from 'react'
import { useAuth } from '@/auth/useAuth'

export type NavKey = 'home' | 'afiliados' | 'reportes' | 'caja' | 'bono' | 'config'

const NAV_ITEMS: { key: NavKey; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'afiliados', label: 'Afiliados' },
  { key: 'reportes', label: 'Reportes' },
  { key: 'caja', label: 'Cierre de caja' },
  { key: 'bono', label: 'Bono de Atención' },
  // { key: 'config', label: 'Configuración' },
]

interface TopNavbarProps {
  selected: NavKey
  onSelect: (key: NavKey) => void
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ selected, onSelect }) => {
  const { user, logout } = useAuth()

  return (
    <header className="topnav">
      <div className="topnav__left">
        <div className="topnav__logo">
          <span className="topnav__logo-mark">M</span>
          <span className="topnav__logo-text">MEDIC Turnos</span>
        </div>

        <nav className="topnav__nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={
                'topnav__nav-item' +
                (selected === item.key ? ' topnav__nav-item--active' : '')
              }
              onClick={() => onSelect(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="topnav__right">
        <span className="topnav__user">{user?.displayName ?? 'Usuario'}</span>
        <button className="topnav__logout" type="button" onClick={() => logout()}>
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
