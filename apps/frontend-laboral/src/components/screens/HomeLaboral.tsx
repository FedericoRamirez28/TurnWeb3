// src/screens/HomeLaboral.tsx
import React, { useMemo, useState } from 'react'
import { useAuth } from '@/auth/useAuth'
import { NotesBoard } from '@/components/ui/home/NotesBoard'
import { CompaniesQuickList } from '@/components/ui/home/CompaniesQuickList'
import { TurnosLaboralCard } from '@/components/ui/home/TurnosLaboralCard'
import { TurnosLaboralAgendaMini } from '@/components/ui/home/TurnosLaboralAgendaMini'
import type { SedeKey } from '@/api/laboralTurnosApi'

export default function HomeLaboral() {
  const { user } = useAuth()

  const notesKey = useMemo(() => {
    const k = user?.username || user?.displayName || 'anon'
    return `medic_laboral_notes_v1_${k}`
  }, [user?.username, user?.displayName])

  // ✅ sede compartida entre “toma de turnos” y “agenda”
  const [sede, setSede] = useState<SedeKey>('sanjusto')

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
              {/* ✅ agenda filtrada por sede */}
              <TurnosLaboralAgendaMini sede={sede} />
            </div>
          </div>
        </div>

        <div className="home-laboral__turnos">
          <div className="home-laboral__turnosWrap">
            {/* ✅ card controla sede y actualiza Home */}
            <TurnosLaboralCard sede={sede} onSedeChange={setSede} />
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
