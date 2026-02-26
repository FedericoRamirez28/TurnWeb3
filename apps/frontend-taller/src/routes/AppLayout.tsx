import React from 'react'
import { Outlet } from 'react-router-dom'
import  TopNavbar  from '@/components/layout/TopNavbar'

export default function AppLayout() {
  return (
    <div>
      <TopNavbar/>
      <Outlet />
    </div>
  )
}
