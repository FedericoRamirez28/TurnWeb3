import React from 'react'
import { Outlet } from 'react-router-dom'
import { TopNavbarLaboral } from '@/components/ui/home/TopNavbarLaboral'

export default function AppShell() {
  return (
    <div className="app-shell">
      <TopNavbarLaboral />
      <div className="app-shell__main">
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
