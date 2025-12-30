// src/routes/AppRouter.tsx
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import HomeScreen from "../screens/HomeScreen";
import ArreglosScreen from "../screens/ArreglosScreen";
import VerFinalizadosScreen from "../screens/VerFinalizadosScreen";
import HistorialPatentesScreen from "../screens/HistorialPatentesScreen";
import HistorialDelDiaScreen from "../screens/HistorialDelDiaScreen";
import ParteDiariaScreen from "../screens/ParteDiariaScreen";

export default function AppRouter() {
  return (
    <Routes>
      {/* Home (lista de móviles) */}
      <Route path="/" element={<HomeScreen />} />

      {/* ✅ Click en ambulancia: /movil/:movilId */}
      <Route path="/movil/:movilId" element={<ArreglosScreen />} />

      {/* Rutas relacionadas al móvil */}
      <Route path="/movil/:movilId/finalizados" element={<VerFinalizadosScreen />} />
      <Route path="/movil/:movilId/historial" element={<HistorialPatentesScreen />} />
      <Route path="/movil/:movilId/historial-dia" element={<HistorialDelDiaScreen />} />

      {/* Parte diaria (QR / url privada) */}
      <Route path="/parte-diaria" element={<ParteDiariaScreen />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
