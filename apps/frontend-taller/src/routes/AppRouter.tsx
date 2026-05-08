import React, { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { TallerUIProvider } from '@/context/TallerUIContext'
import AppLayout from './AppLayout'

import HomeScreen from '../screens/HomeScreen'
import ArreglosScreen from '../screens/ArreglosScreen'
import VerFinalizadosScreen from '../screens/VerFinalizadosScreen'
import HistorialPatentesScreen from '../screens/HistorialPatentesScreen'
import HistorialDelDiaScreen from '../screens/HistorialDelDiaScreen'
import ParteDiariaScreen from '../screens/ParteDiariaScreen'
import LoginScreen from '../screens/LoginScreen'

import { api } from '@/lib/api'
import { clearAuth, getToken, setUser, type AuthUser } from '@/lib/auth'

function AuthGate({ children }: { children: React.ReactNode }) {
  const loc = useLocation()
  const [booting, setBooting] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let alive = true

    async function boot() {
      const token = getToken()
      if (!token) {
        if (!alive) return
        setAuthed(false)
        setBooting(false)
        return
      }

      const r = await api.get<AuthUser>('/auth/me')
      if (!alive) return

      if (r.ok && r.data) {
        setUser(r.data)
        setAuthed(true)
      } else {
        clearAuth()
        setAuthed(false)
      }

      setBooting(false)
    }

    boot()
    return () => {
      alive = false
    }
  }, [])

  if (booting) return <div style={{ padding: 16 }}>Cargando…</div>

  if (!authed) {
    const next = encodeURIComponent(loc.pathname + (loc.search || ''))
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return <>{children}</>
}

export default function AppRouter() {
  return (
    <TallerUIProvider>
      <Routes>
        {/* ✅ Públicas */}
        <Route path="/login" element={<LoginScreen />} />

        {/* ✅ URL FIJA por móvil para chofer: /parte-diaria/10 */}
        <Route path="/parte-diaria/:movilId" element={<ParteDiariaScreen />} />

        {/* (opcional) si querés permitir /parte-diaria sin param */}
        <Route path="/parte-diaria" element={<ParteDiariaScreen />} />

        {/* ✅ Protegidas */}
        <Route
          element={
            <AuthGate>
              <AppLayout />
            </AuthGate>
          }
        >
          <Route path="/" element={<HomeScreen />} />

          <Route path="/finalizados" element={<VerFinalizadosScreen />} />
          <Route path="/historial" element={<HistorialPatentesScreen />} />
          <Route path="/historial-dia" element={<HistorialDelDiaScreen />} />

          <Route path="/movil/:movilId" element={<ArreglosScreen />} />

          <Route path="/movil/:movilId/finalizados" element={<VerFinalizadosScreen />} />
          <Route path="/movil/:movilId/historial" element={<HistorialPatentesScreen />} />
          <Route path="/movil/:movilId/historial-dia" element={<HistorialDelDiaScreen />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </TallerUIProvider>
  )
}
