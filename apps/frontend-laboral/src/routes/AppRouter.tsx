import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoutes from './ProtectedRoutes'
import AppShell from '@/components/layout/AppShell'

import LoginScreen from '@/components/screens/LoginScreen'
import HomeLaboral from '@/components/screens/HomeLaboral'
import PreciosScreen from '@/components/screens/PreciosScreen'
import PortadaScreen from '@/components/screens/PortadaScreen'
import PreocupacionalScreen from '@/components/screens/PreocupacionalScreen'
import ConsultoriosScreen from '@/components/screens/ConsultoriosScreens'
import AdicionalesScreen from '@/components/screens/AdicionalScreen'
import ECGCaptureScreen from '@/components/screens/ECGCaptureScreen'
import '@/styles/global.scss'

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginScreen />} />

        {/* Protected */}
        <Route element={<ProtectedRoutes />}>
          <Route path="/" element={<AppShell />}>
            <Route index element={<HomeLaboral />} />
            <Route path="preocupacional" element={<PreocupacionalScreen />} />
            <Route path="portada" element={<PortadaScreen />} />
            <Route path="consultorios" element={<ConsultoriosScreen />} />
            <Route path="adicionales" element={<AdicionalesScreen />} />
            <Route path="precios" element={<PreciosScreen />} />
            <Route path="ecg" element={<ECGCaptureScreen />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
