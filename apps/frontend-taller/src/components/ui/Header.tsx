import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SearchInputHighlight from './SearchInputHighlight'
import { clearAuth } from '@/lib/auth'

type Props = {
  variant?: 'home' | 'inner'
  title?: string
  showBack?: boolean
  onBack?: () => void
  onBuscar?: (value: string) => void
  buscarValue?: string
  onToggleSidebar?: () => void
  showBurger?: boolean
  showLogout?: boolean
  logoFullSrc?: string
  logoMarkSrc?: string
}

export default function Header({
  variant = 'home',
  title = 'Taller Solutions',
  showBack = false,
  onBack,
  onBuscar,
  buscarValue = '',
  onToggleSidebar,
  showBurger = false,
  showLogout = true,
  logoFullSrc,
  logoMarkSrc,
}: Props) {
  const isHome = variant === 'home'
  const location = useLocation()
  const navigate = useNavigate()

  const pathname = location.pathname || '/'
  const hideSearch = /^\/movil\//.test(pathname)
  const placeholder = pathname.includes('/finalizados') ? 'Buscar finalizado…' : 'Buscar arreglo…'

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

    navigate('/login', { replace: true })
  }

  return (
    <header className={`ts-header ${isHome ? 'ts-header--home' : 'ts-header--inner'}`}>
      <div className="ts-header__left">
        {showBurger && onToggleSidebar && (
          <button className="hdr-burger" aria-label="Abrir menú" title="Menú" onClick={onToggleSidebar} type="button">
            <span />
            <span />
            <span />
          </button>
        )}

        {!isHome && logoMarkSrc && (
          <img src={logoMarkSrc} alt="Taller Solutions" className="logo-mark" width={28} height={28} />
        )}

        {showBack && (
          <button className="icon-btn" aria-label="Volver" title="Volver" onClick={onBack} type="button">
            ←
          </button>
        )}
      </div>

      <div className="ts-header__center">
        {isHome ? (
          logoFullSrc ? (
            <img src={logoFullSrc} alt="Taller Solutions" className="logo-full" />
          ) : (
            <h1 className="title">{title}</h1>
          )
        ) : (
          <h1 className="title">{title}</h1>
        )}
      </div>

      <div className="ts-header__right">
        {onBuscar && !hideSearch && (
          <SearchInputHighlight value={buscarValue} placeholder={placeholder} onChangeText={onBuscar} />
        )}

        {showLogout && (
          <button className="hdr-logout" type="button" onClick={handleLogout} title="Cerrar sesión">
            Cerrar sesión
          </button>
        )}
      </div>
    </header>
  )
}
