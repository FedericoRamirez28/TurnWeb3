import React from 'react'

export type PriorityFilter = 'all' | 'baja' | 'alta' | 'urgente'

type TallerUIState = {
  query: string
  setQuery: (v: string) => void
  priority: PriorityFilter
  setPriority: (v: PriorityFilter) => void
  resetFilters: () => void
}

const TallerUIContext = React.createContext<TallerUIState | null>(null)

export function TallerUIProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = React.useState('')
  const [priority, setPriority] = React.useState<PriorityFilter>('all')

  const resetFilters = React.useCallback(() => {
    setQuery('')
    setPriority('all')
  }, [])

  const value = React.useMemo(
    () => ({ query, setQuery, priority, setPriority, resetFilters }),
    [query, priority, resetFilters]
  )

  return <TallerUIContext.Provider value={value}>{children}</TallerUIContext.Provider>
}

export function useTallerUI() {
  const ctx = React.useContext(TallerUIContext)
  if (!ctx) throw new Error('useTallerUI debe usarse dentro de <TallerUIProvider>')
  return ctx
}
