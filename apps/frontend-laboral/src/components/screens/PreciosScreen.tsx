// apps/frontend-laboral/src/components/screens/PreciosScreen.tsx
import React, { useMemo, useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import jsPDF from 'jspdf'
import {
  adjustTurnosPrecios,
  listTurnosPrecios,
  getTurnosBundle,
  adjustLaboralPrecios,
  listLaboralPrecios,
  type ModeKey,
  type PlanKey,
  type ScopeKey,
  type TurnosPrecioRowDB,
  type LaboralPrecioRowDB,
} from '@/api/preciosApi'

type TabKey = 'turnos' | 'laboral'

type TurnosRowUI = {
  id: string
  tipo: 'Laboratorio' | 'Especialidad'
  nombre: string
  plan: Exclude<PlanKey, 'ALL'>
  valor: number
  updatedAt: string
}

type LaboralRowUI = {
  id: string
  categoria: string
  nombre: string
  valorSocios: number
  valorNoSocios: number
  updatedAt: string
}

function mapTurnosRow(r: TurnosPrecioRowDB): TurnosRowUI {
  return {
    id: r.id,
    tipo: r.tipo === 'LABORATORIO' ? 'Laboratorio' : 'Especialidad',
    nombre: r.nombre,
    plan: r.plan,
    valor: r.valor,
    updatedAt: r.updatedAt,
  }
}

function mapLaboralRow(r: LaboralPrecioRowDB): LaboralRowUI {
  return {
    id: r.id,
    categoria: r.categoria,
    nombre: r.nombre,
    valorSocios: r.valorSocios,
    valorNoSocios: r.valorNoSocios,
    updatedAt: r.updatedAt,
  }
}

// 👇 MISMA KEY que usa frontend-turnos/src/hooks/useTurnoPrices.ts
const TURNOS_BUNDLE_LS_KEY = 'medic_turnos_prices_bundle_v2'
const PRICES_UPDATED_EVENT = 'medic:turnos-prices-updated'

function normalizeText(s: string): string {
  return (s ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function fmtMoney(n: number): string {
  const v = Number(n || 0)
  return `$${v.toLocaleString()}`
}

function fmtDate(d: string): string {
  if (!d) return ''
  const t = new Date(d).getTime()
  if (!Number.isFinite(t)) return ''
  return new Date(t).toLocaleDateString()
}

export default function PreciosScreen() {
  const [tab, setTab] = useState<TabKey>('turnos')

  // Turnos filters
  const [plan, setPlan] = useState<PlanKey>('ALL')
  const [scope, setScope] = useState<ScopeKey>('ambos')

  // Laboral filters
  const [categoria, setCategoria] = useState<string>('ALL')

  // Search
  const [q, setQ] = useState('')

  // Shared modal state
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ModeKey>('increase')
  const [percent, setPercent] = useState('10')

  // Data
  const [turnosRows, setTurnosRows] = useState<TurnosRowUI[]>([])
  const [laboralRows, setLaboralRows] = useState<LaboralRowUI[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const percentValue = useMemo(() => {
    const v = Number(percent.replace(',', '.'))
    return Number.isFinite(v) ? v : NaN
  }, [percent])

  const canApply =
    Number.isFinite(percentValue) && percentValue > 0 && percentValue <= 200 && !loading

  const activeRowsUpdatedAt = useMemo(() => {
    const rows = tab === 'turnos' ? turnosRows : laboralRows
    let max = 0
    for (const r of rows) {
      const t = new Date(r.updatedAt).getTime()
      if (Number.isFinite(t) && t > max) max = t
    }
    return max ? new Date(max).toISOString() : null
  }, [tab, turnosRows, laboralRows])

  const laboralCategorias = useMemo(() => {
    const set = new Set<string>()
    for (const r of laboralRows) {
      const c = String(r.categoria || '').trim()
      if (c) set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [laboralRows])

  const fetchTurnos = async (p: PlanKey, s: ScopeKey) => {
    setLoading(true)
    setError(null)
    try {
      const data = await listTurnosPrecios({ plan: p, scope: s })
      setTurnosRows((data.rows ?? []).map(mapTurnosRow))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando precios')
    } finally {
      setLoading(false)
    }
  }

  const fetchLaboral = async (cat: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await listLaboralPrecios({
        categoria: cat === 'ALL' ? undefined : cat,
      })
      setLaboralRows((data.rows ?? []).map(mapLaboralRow))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando precios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab !== 'turnos') return
    void fetchTurnos(plan, scope)
  }, [tab, plan, scope])

  useEffect(() => {
    if (tab !== 'laboral') return
    void fetchLaboral(categoria)
  }, [tab, categoria])

  const filteredTurnosRows = useMemo(() => {
    const query = normalizeText(q)
    if (!query) return turnosRows
    const tokens = query.split(/\s+/).filter(Boolean)

    return turnosRows.filter((r) => {
      const hay = normalizeText(
        `${r.tipo} ${r.nombre} ${r.plan} ${r.valor} ${fmtDate(r.updatedAt)}`,
      )
      return tokens.every((t) => hay.includes(t))
    })
  }, [turnosRows, q])

  const filteredLaboralRows = useMemo(() => {
    const query = normalizeText(q)
    if (!query) return laboralRows
    const tokens = query.split(/\s+/).filter(Boolean)

    return laboralRows.filter((r) => {
      const hay = normalizeText(
        `${r.categoria} ${r.nombre} ${r.valorSocios} ${r.valorNoSocios} ${fmtDate(r.updatedAt)}`,
      )
      return tokens.every((t) => hay.includes(t))
    })
  }, [laboralRows, q])

  async function syncTurnosBundleCache() {
    try {
      const bundle = await getTurnosBundle()

      try {
        localStorage.setItem(TURNOS_BUNDLE_LS_KEY, JSON.stringify(bundle))
      } catch {
        // no-op
      }

      window.dispatchEvent(
        new CustomEvent(PRICES_UPDATED_EVENT, {
          detail: { updatedAt: bundle.updatedAt },
        }),
      )
    } catch {
      // no rompemos
    }
  }

  async function applyAdjustment() {
    if (!canApply) return

    try {
      setLoading(true)

      if (tab === 'turnos') {
        const result = await adjustTurnosPrecios({
          plan,
          scope,
          mode,
          percent: percentValue,
        })

        setOpen(false)

        await Swal.fire({
          title: 'Listo',
          text: `Se actualizaron ${result.updated} precios.`,
          icon: 'success',
          timer: 1400,
          showConfirmButton: false,
        })

        await fetchTurnos(plan, scope)
        await syncTurnosBundleCache()
        return
      }

      // laboral
      const result = await adjustLaboralPrecios({
        categoria: categoria === 'ALL' ? undefined : categoria,
        mode,
        percent: percentValue,
      })

      setOpen(false)

      await Swal.fire({
        title: 'Listo',
        text: `Se actualizaron ${result.updated} precios.`,
        icon: 'success',
        timer: 1400,
        showConfirmButton: false,
      })

      await fetchLaboral(categoria)
    } catch (e) {
      await Swal.fire({
        title: 'Error',
        text: e instanceof Error ? e.message : 'No se pudo aplicar el ajuste',
        icon: 'error',
        confirmButtonText: 'Cerrar',
      })
    } finally {
      setLoading(false)
    }
  }

  function downloadPdf() {
    const now = new Date()
    // Definimos rows explícitamente para el loop
    const rows = tab === 'turnos' ? filteredTurnosRows : filteredLaboralRows

    if (!rows.length) {
      void Swal.fire({
        title: 'Sin datos',
        text: 'No hay filas para exportar con los filtros actuales.',
        icon: 'info',
        confirmButtonText: 'Cerrar',
      })
      return
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const marginX = 36
    const marginY = 44
    const lineH = 12
    const padY = 6

    const title = tab === 'turnos' ? 'Precios · Turnos' : 'Precios · Medicina Laboral'
    const subtitle =
      tab === 'turnos'
        ? `Plan: ${plan} · Alcance: ${
            scope === 'ambos'
              ? 'Laboratorios y Especialidades'
              : scope === 'laboratorio'
                ? 'Solo Laboratorios'
                : 'Solo Especialidades'
          }`
        : `Categoría: ${categoria === 'ALL' ? 'Todas' : categoria}`

    const searchLine = q.trim() ? `Búsqueda: "${q.trim()}"` : 'Búsqueda: (sin filtro)'
    const dateLine = `Generado: ${now.toLocaleString()}`

    function drawHeader() {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(title, marginX, marginY)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(subtitle, marginX, marginY + 16)
      doc.text(searchLine, marginX, marginY + 30)
      doc.text(dateLine, marginX, marginY + 44)

      doc.setDrawColor(210)
      doc.line(marginX, marginY + 54, pageW - marginX, marginY + 54)
    }

    const colsTurnos = [
      { label: 'Tipo', w: 90 },
      { label: 'Nombre', w: 260 },
      { label: 'Plan', w: 80 },
      { label: 'Precio', w: 90 },
      { label: 'Actualizado', w: 90 },
    ]

    const colsLaboral = [
      { label: 'Categoría', w: 100 },
      { label: 'Concepto', w: 260 },
      { label: 'Socios', w: 90 },
      { label: 'Particular', w: 90 },
      { label: 'Actualizado', w: 90 },
    ]

    const cols = tab === 'turnos' ? colsTurnos : colsLaboral

    const totalW = cols.reduce((a, c) => a + c.w, 0)
    const scale = Math.min(1, (pageW - marginX * 2) / totalW)
    const scaledCols = cols.map((c) => ({ ...c, w: Math.floor(c.w * scale) }))

    function drawTableHeader(y: number) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)

      let x = marginX
      for (const c of scaledCols) {
        doc.text(c.label, x, y)
        x += c.w
      }

      doc.setDrawColor(220)
      doc.line(marginX, y + 4, pageW - marginX, y + 4)
    }

    function ensurePage(y: number, needed: number) {
      const bottom = pageH - marginY
      if (y + needed <= bottom) return y
      doc.addPage()
      drawHeader()
      const newY = marginY + 82
      drawTableHeader(newY)
      return newY + 16
    }

    drawHeader()
    let y = marginY + 82
    drawTableHeader(y)
    y += 16

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)

    for (const r of rows) {
      const cells =
        tab === 'turnos'
          ? [
              String((r as TurnosRowUI).tipo ?? ''),
              String((r as TurnosRowUI).nombre ?? ''),
              String((r as TurnosRowUI).plan ?? ''),
              fmtMoney(Number((r as TurnosRowUI).valor ?? 0)),
              fmtDate(String(r.updatedAt ?? '')),
            ]
          : [
              String((r as LaboralRowUI).categoria ?? ''),
              String((r as LaboralRowUI).nombre ?? ''),
              fmtMoney(Number((r as LaboralRowUI).valorSocios ?? 0)),
              fmtMoney(Number((r as LaboralRowUI).valorNoSocios ?? 0)),
              fmtDate(String(r.updatedAt ?? '')),
            ]

      let x = marginX
      const linesPerCell: string[][] = []

      for (let i = 0; i < scaledCols.length; i++) {
        const w = scaledCols[i].w
        const text = cells[i] ?? ''
        const lines = doc.splitTextToSize(String(text), Math.max(40, w - 8))
        linesPerCell.push(lines)
        x += w
      }

      const rowLines = Math.max(...linesPerCell.map((l) => l.length))
      const rowH = rowLines * lineH + padY

      y = ensurePage(y, rowH)

      x = marginX
      for (let i = 0; i < scaledCols.length; i++) {
        const w = scaledCols[i].w
        const lines = linesPerCell[i]
        doc.text(lines, x, y)
        x += w
      }

      y += rowH

      doc.setDrawColor(245)
      doc.line(marginX, y - 8, pageW - marginX, y - 8)
    }

    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const fname =
      tab === 'turnos'
        ? `precios_turnos_${yyyy}-${mm}-${dd}.pdf`
        : `precios_laboral_${yyyy}-${mm}-${dd}.pdf`
    doc.save(fname)
  }

  const tableRows = tab === 'turnos' ? filteredTurnosRows : filteredLaboralRows
  const hasServerRows = tab === 'turnos' ? turnosRows.length > 0 : laboralRows.length > 0
  const isEmptyBySearch = hasServerRows && tableRows.length === 0 && !!q.trim()

  return (
    <div className="precios">
      <div className="card">
        <div className="card__header">
          <div>
            <h2 className="card__title">Gestión de precios</h2>

            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={tab === 'turnos' ? 'btn btn--primary' : 'btn btn--outline'}
                onClick={() => setTab('turnos')}
                disabled={loading}
              >
                Turnos
              </button>
              <button
                type="button"
                className={tab === 'laboral' ? 'btn btn--primary' : 'btn btn--outline'}
                onClick={() => setTab('laboral')}
                disabled={loading}
              >
                Medicina Laboral
              </button>
            </div>

            <p className="card__subtitle" style={{ marginTop: 10 }}>
              {tab === 'turnos'
                ? 'Ajuste porcentual y listado. Los  precios modificados se catualizaran luego de refrescar en el sistema de turnos web'
                : 'Ajuste porcentual y listado.'}
              {activeRowsUpdatedAt
                ? ` · Última actualización: ${new Date(activeRowsUpdatedAt).toLocaleString()}`
                : ''}
            </p>

            {error && (
              <p className="card__subtitle" style={{ marginTop: 6 }}>
                {error}
              </p>
            )}
          </div>

          <div className="precios__actions">
            {tab === 'turnos' ? (
              <>
                <select
                  className="input precios__select"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as PlanKey)}
                  disabled={loading}
                >
                  <option value="ALL">Todos los planes</option>
                  <option value="BASE">BASE</option>
                  <option value="ESMERALDA">ESMERALDA</option>
                  <option value="RUBI">RUBÍ</option>
                  <option value="DORADO">DORADO</option>
                  <option value="PARTICULAR">PARTICULAR</option>
                </select>

                <select
                  className="input precios__select"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as ScopeKey)}
                  disabled={loading}
                >
                  <option value="ambos">Laboratorios y Especialidades</option>
                  <option value="laboratorio">Solo Laboratorios</option>
                  <option value="especialidad">Solo Especialidades</option>
                </select>
              </>
            ) : (
              <select
                className="input precios__select"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                disabled={loading}
              >
                <option value="ALL">Todas las categorías</option>
                {laboralCategorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <input
              className="input precios__select"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (nombre, categoría, plan, monto...)"
              disabled={loading}
            />

            <button
              className="btn btn--outline"
              type="button"
              onClick={downloadPdf}
              disabled={loading || tableRows.length === 0}
              title={tableRows.length === 0 ? 'No hay filas para exportar' : 'Descargar PDF'}
            >
              Descargar PDF
            </button>

            <button
              className="btn btn--primary"
              type="button"
              onClick={() => setOpen(true)}
              disabled={loading}
            >
              Ajuste porcentual
            </button>
          </div>
        </div>

        {tab === 'turnos' ? (
          <table className="summary__table precios__table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Nombre</th>
                <th>Plan</th>
                <th>Precio</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {loading && turnosRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    Cargando…
                  </td>
                </tr>
              ) : isEmptyBySearch ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    No hay resultados para la búsqueda.
                  </td>
                </tr>
              ) : filteredTurnosRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    No hay precios cargados.
                  </td>
                </tr>
              ) : (
                filteredTurnosRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.tipo}</td>
                    <td>{r.nombre}</td>
                    <td>{r.plan}</td>
                    <td>{fmtMoney(Number(r.valor || 0))}</td>
                    <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="summary__table precios__table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Concepto</th>
                <th>Socios</th>
                <th>Particular y prestaciones</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {loading && laboralRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    Cargando…
                  </td>
                </tr>
              ) : isEmptyBySearch ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    No hay resultados para la búsqueda.
                  </td>
                </tr>
              ) : filteredLaboralRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14 }}>
                    No hay precios cargados.
                  </td>
                </tr>
              ) : (
                filteredLaboralRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.categoria}</td>
                    <td>{r.nombre}</td>
                    <td>{fmtMoney(Number(r.valorSocios || 0))}</td>
                    <td>{fmtMoney(Number(r.valorNoSocios || 0))}</td>
                    <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : ''}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-card__header">
              <div>
                <h3 className="modal-card__title">Ajuste porcentual</h3>
                <p className="modal-card__subtitle">
                  {tab === 'turnos'
                    ? `Se aplica sobre ${
                        scope === 'ambos'
                          ? 'Laboratorios y Especialidades'
                          : scope === 'laboratorio'
                            ? 'Laboratorios'
                            : 'Especialidades'
                      }${plan !== 'ALL' ? ` · Plan ${plan}` : ' · Todos los planes'}`
                    : `Se aplica sobre Medicina Laboral${
                        categoria !== 'ALL'
                          ? ` · Categoría ${categoria}`
                          : ' · Todas las categorías'
                      }`}
                </p>
              </div>

              <button
                className="btn btn--ghost btn--sm"
                type="button"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-card__body">
              <div className="grid-2">
                {tab === 'laboral' ? (
                  <label className="field">
                    <span className="field__label">Aplicar a</span>
                    <select
                      className="input"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      disabled={loading}
                    >
                      <option value="ALL">Todas las categorías</option>
                      {laboralCategorias.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="field">
                    <span className="field__label">Aplicar a</span>
                    <select
                      className="input"
                      value={scope}
                      onChange={(e) => setScope(e.target.value as ScopeKey)}
                      disabled={loading}
                    >
                      <option value="ambos">Laboratorios y Especialidades</option>
                      <option value="laboratorio">Solo Laboratorios</option>
                      <option value="especialidad">Solo Especialidades</option>
                    </select>
                  </label>
                )}

                <label className="field">
                  <span className="field__label">Tipo</span>
                  <select
                    className="input"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ModeKey)}
                    disabled={loading}
                  >
                    <option value="increase">Aumentar</option>
                    <option value="decrease">Disminuir</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">Porcentaje</span>
                  <div className="percent">
                    <input
                      className="input"
                      value={percent}
                      onChange={(e) => setPercent(e.target.value)}
                      inputMode="decimal"
                      placeholder="Ej: 10"
                      disabled={loading}
                    />
                    <span className="percent__suffix">%</span>
                  </div>
                  <small className="field__hint">1 a 200</small>
                </label>
              </div>
            </div>

            <div className="modal-card__footer">
              <button
                className="btn btn--outline"
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                className="btn btn--primary"
                type="button"
                onClick={applyAdjustment}
                disabled={!canApply}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}