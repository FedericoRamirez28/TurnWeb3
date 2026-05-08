import React from 'react'
import { AuthProvider } from '@/auth/AuthProvider'
import { useAuth } from '@/auth/useAuth'
import LoginScreen from '@/components/screens/LoginScreen'
import { HomeScreen } from '@/components/screens/HomeScreen'
import { VerificarBonoScreen } from '@/components/screens/VerificarBonoScreen'

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function ProtectedHome() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <LoginScreen />
  return <HomeScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* App normal protegida */}
          <Route path="/" element={<ProtectedHome />} />

          {/* Ruta pública para QR */}
          <Route path="/bonos/verificar/:code" element={<VerificarBonoScreen />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
