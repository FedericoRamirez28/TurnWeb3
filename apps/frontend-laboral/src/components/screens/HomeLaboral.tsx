// src/screens/HomeLaboral.tsx
import React, { useMemo } from 'react'
import { useAuth } from '@/auth/useAuth'
import { NotesBoard } from '@/components/ui/home/NotesBoard'
import { CompaniesQuickList } from '@/components/ui/home/CompaniesQuickList'
import { TurnosLaboralCard } from '@/components/ui/home/TurnosLaboralCard'
import { TurnosLaboralAgendaMini } from '@/components/ui/home/TurnosLaboralAgendaMini'

export default function HomeLaboral() {
  const { user } = useAuth()

  const notesKey = useMemo(() => {
    const k = user?.username || user?.displayName || 'anon'
    return `medic_laboral_notes_v1_${k}`
  }, [user?.username, user?.displayName])

  return (
    <div className="home-laboral">
      <div className="home-laboral__grid">
        <div className="home-laboral__empresas">
          <div className="card home-laboral__card home-laboral__card--companies">
            <div className="home-laboral__cardBody">
              <CompaniesQuickList />
            </div>
          </div>

          <div className="card home-laboral__card home-laboral__card--agenda">
            <div className="home-laboral__cardBody">
              <TurnosLaboralAgendaMini />
            </div>
          </div>
        </div>

        <div className="home-laboral__turnos">
          <div className="home-laboral__turnosWrap">
            <TurnosLaboralCard />
          </div>
        </div>

        <div className="home-laboral__notes">
          <div className="card home-laboral__card home-laboral__card--notes">
            <div className="home-laboral__cardBody">
              <NotesBoard key={notesKey} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
