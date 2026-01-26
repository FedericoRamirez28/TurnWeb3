import React from 'react'
import { Outlet } from 'react-router-dom'
import { TopNavbar } from '@/components/layout/TopNavbar'

export default function AppLayout() {
  return (
    <div>
      <TopNavbar
        onToggleSidebar={() => {
          // si después metés sidebar, lo conectás acá:
          window.dispatchEvent(new CustomEvent('ts:toggle-sidebar'))
        }}
        // userName="Usuario"
        // onLogout={() => ...}
      />
      <Outlet />
    </div>
  )
}
