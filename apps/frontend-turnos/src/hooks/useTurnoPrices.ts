import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getTurnosBundle,
  getTurnosVersion,
  type BundleTurnosResponse,
  type PlanClave,
  ApiError,
} from '@/api/preciosApi'

// ✅ bump de cache para tirar el bundle viejo contaminado
const LS_KEY = 'medic_turnos_prices_bundle_v3'

function normalizePlan(plan: string): PlanClave | undefined {
  const up = (plan || '').toUpperCase()
  if (up.includes('DORADO')) return 'DORADO'
  if (up.includes('RUBI')) return 'RUBI'
  if (up.includes('ESMERALDA')) return 'ESMERALDA'
  if (up.includes('BASE')) return 'BASE'
  if (up.includes('PART')) return 'PARTICULAR'
  return undefined
}

function isValidBundle(x: unknown): x is BundleTurnosResponse {
  if (!x || typeof x !== 'object') return false
  const b = x as BundleTurnosResponse
  return (
    typeof b.updatedAt === 'string' &&
    Array.isArray(b.laboratorioOptions) &&
    Array.isArray(b.especialidadesOptions) &&
    !!b.laboratoriosTarifas &&
    typeof b.laboratoriosTarifas === 'object' &&
    !!b.especialidadesTarifas &&
    typeof b.especialidadesTarifas === 'object'
  )
}

function readCache(): BundleTurnosResponse | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isValidBundle(parsed)) return null
    return sanitizeBundle(parsed)
  } catch {
    return null
  }
}

function writeCache(bundle: BundleTurnosResponse) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(bundle))
  } catch {
    // no-op
  }
}

function getPollMs(): number {
  const raw = String(import.meta.env.VITE_PRECIOS_POLL_MS ?? '').trim()
  const n = Number(raw)
  return Number.isFinite(n) && n >= 10_000 ? n : 120_000
}

/* =========================
   SANITIZACIÓN (anti-bug)
   - si especialidadesOptions viene con laboratorios, lo arregla
   - deriva options desde las claves reales de las tarifas
   ========================= */

function uniqSorted(xs: string[]): string[] {
  return Array.from(new Set(xs.map((s) => String(s).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
}

function keysUnion(mapByPlan: Record<string, Record<string, unknown>> | undefined): string[] {
  if (!mapByPlan || typeof mapByPlan !== 'object') return []
  const out: string[] = []
  for (const plan of Object.keys(mapByPlan)) {
    const bucket = mapByPlan[plan]
    if (!bucket || typeof bucket !== 'object') continue
    out.push(...Object.keys(bucket))
  }
  return uniqSorted(out)
}

function isProbablyWrongOptions(primary: string[], derived: string[]): boolean {
  if (primary.length === 0 && derived.length > 0) return true
  if (primary.length > 0 && derived.length > 0 && primary.length < Math.floor(derived.length * 0.35))
    return true
  return false
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function sanitizeBundle(raw: BundleTurnosResponse): BundleTurnosResponse {
  const derivedLabs = keysUnion(raw.laboratoriosTarifas as unknown as Record<string, Record<string, unknown>>)
  const derivedEsp = keysUnion(raw.especialidadesTarifas as unknown as Record<string, Record<string, unknown>>)

  const primaryLabs = uniqSorted(Array.isArray(raw.laboratorioOptions) ? raw.laboratorioOptions : [])
  const primaryEsp = uniqSorted(Array.isArray(raw.especialidadesOptions) ? raw.especialidadesOptions : [])

  const fixedLabs = isProbablyWrongOptions(primaryLabs, derivedLabs) ? derivedLabs : primaryLabs
  const fixedEsp0 = isProbablyWrongOptions(primaryEsp, derivedEsp) ? derivedEsp : primaryEsp

  // Caso del bug: especialidadesOptions == laboratorioOptions
  const fixedEsp = arraysEqual(fixedEsp0, fixedLabs) && derivedEsp.length > 0 ? derivedEsp : fixedEsp0

  return {
    ...raw,
    laboratorioOptions: fixedLabs,
    especialidadesOptions: fixedEsp,
  }
}

/* =========================
   HOOK
   ========================= */

export function useTurnosPrices() {
  const cached = useMemo(() => readCache(), [])
  const [bundle, setBundle] = useState<BundleTurnosResponse | null>(() => cached)
  const [loading, setLoading] = useState<boolean>(() => !cached)
  const [error, setError] = useState<string | null>(null)

  const lastUpdatedAtRef = useRef<string | null>(cached?.updatedAt ?? null)
  const versionEndpointSupportedRef = useRef<boolean | null>(null)

  const setBundleSafe = useCallback((b: BundleTurnosResponse) => {
    const fixed = sanitizeBundle(b)
    setBundle(fixed)
    writeCache(fixed)
    lastUpdatedAtRef.current = fixed.updatedAt ?? null
  }, [])

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent)
      if (!silent) setLoading((prev) => (bundle ? prev : true))

      try {
        const b = await getTurnosBundle()
        setBundleSafe(b)
        setError(null)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error cargando precios')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [bundle, setBundleSafe],
  )

  // mount: cache-first, revalidate
  useEffect(() => {
    let alive = true

    setLoading(!cached)
    refresh({ silent: true })
      .catch(() => {})
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // polling
  useEffect(() => {
    const pollMs = getPollMs()
    let stopped = false

    const tick = async () => {
      if (stopped) return

      // 1) si existe /version, lo usamos
      if (versionEndpointSupportedRef.current !== false) {
        try {
          const v = await getTurnosVersion()
          versionEndpointSupportedRef.current = true

          const prev = lastUpdatedAtRef.current
          if (!prev || (v.updatedAt && v.updatedAt !== prev)) {
            await refresh({ silent: true })
          }
          return
        } catch (e: unknown) {
          if (e instanceof ApiError && e.status === 404) {
            versionEndpointSupportedRef.current = false
          }
        }
      }

      // 2) fallback: poll del bundle
      try {
        const b = await getTurnosBundle()
        const prev = lastUpdatedAtRef.current
        if (!prev || (b.updatedAt && b.updatedAt !== prev)) {
          setBundleSafe(b)
          setError(null)
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error cargando precios')
      }
    }

    const id = window.setInterval(() => void tick(), pollMs)
    void tick()

    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [refresh, setBundleSafe])

  const laboratorioOptions = useMemo(() => {
    const list = bundle?.laboratorioOptions ?? []
    return list.slice().sort((a, b) => a.localeCompare(b))
  }, [bundle])

  const especialidadesOptions = useMemo(() => {
    const list = bundle?.especialidadesOptions ?? []
    return list.slice().sort((a, b) => a.localeCompare(b))
  }, [bundle])

  const getLaboratorioPrice = useCallback(
    (nombre: string, planRaw: string): number => {
      if (!bundle || !nombre) return 0
      const plan = normalizePlan(planRaw) ?? 'BASE'
      return (
        bundle.laboratoriosTarifas?.[plan]?.[nombre] ??
        bundle.laboratoriosTarifas?.BASE?.[nombre] ??
        0
      )
    },
    [bundle],
  )

  const getEspecialidadPrice = useCallback(
    (nombre: string, planRaw: string): number => {
      if (!bundle || !nombre) return 0
      const plan = normalizePlan(planRaw) ?? 'BASE'
      return (
        bundle.especialidadesTarifas?.[plan]?.[nombre] ??
        bundle.especialidadesTarifas?.BASE?.[nombre] ??
        0
      )
    },
    [bundle],
  )

  const revision = useMemo(() => {
    if (!bundle?.updatedAt) return 0
    const t = new Date(bundle.updatedAt).getTime()
    return Number.isFinite(t) ? t : 0
  }, [bundle])

  return {
    loading,
    error,
    revision,
    updatedAt: bundle?.updatedAt ?? null,
    laboratorioOptions,
    especialidadesOptions,
    getLaboratorioPrice,
    getEspecialidadPrice,
    refresh,
  }
}
