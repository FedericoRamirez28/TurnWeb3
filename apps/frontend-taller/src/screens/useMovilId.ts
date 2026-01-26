import { useParams, useSearchParams } from 'react-router-dom'

type Params = { movilId?: string }

export function useMovilId(): string | null {
  const { movilId: movilIdParam } = useParams<Params>()
  const [sp] = useSearchParams()

  const fromParam = movilIdParam?.trim()
  if (fromParam) return fromParam

  const fromQuery = sp.get('movilId')?.trim()
  if (fromQuery) return fromQuery

  return null
}
